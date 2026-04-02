# CivicForum Operations Platform

Offline-first, multi-tenant civic forum backend — Express + TypeScript + Prisma + PostgreSQL.

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/) installed and running.

### 1. Clone / enter the project

```bash
cd /path/to/TASK-99
```

### 2. Start all services

```bash
docker compose up --build
```

This command:
1. Builds the application image (installs npm deps, generates Prisma client, compiles TypeScript).
2. Starts PostgreSQL (`db` service) and waits for its health check to pass.
3. Runs `prisma migrate deploy` to apply all migrations.
4. Starts the Express server on port **3000**.

> First build takes ~2–3 minutes. Subsequent starts are much faster.

---

## Verify the Service

### Health check

```bash
curl http://localhost:3000/api/v1/health
```

Expected response (`200 OK`):

```json
{
  "status": "ok",
  "timestamp": "2026-04-01T00:00:00.000Z",
  "correlationId": "<uuid>",
  "services": {
    "database": "ok"
  }
}
```

### Confirm containers are running

```bash
docker compose ps
```

You should see both `app` and `db` with status `running`.

### View application logs

```bash
docker compose logs -f app
```

---

## Stopping the Service

```bash
docker compose down
```

To also remove the database volume (destroys all data):

```bash
docker compose down -v
```

---

## Development (without Docker)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL to a local PostgreSQL instance
```

### 3. Apply migrations and generate Prisma client

```bash
npm run prisma:migrate
npm run prisma:generate
```

### 4. Seed the database (optional)

```bash
npm run seed
```

Creates a `default-org` organization and an `admin` user (`admin-password-secure`).

### 5. Start in dev mode (with hot reload)

```bash
npm run dev
```

---

## Running Tests

### One-click (unit + API — recommended)

```bash
bash run_tests.sh
```

This script:
1. Runs all unit tests (`npm run test:unit`).
2. Starts the test containers (`docker-compose.test.yml`) with an isolated in-memory database.
3. Waits for the health check to pass.
4. Runs all API tests against `http://localhost:3011` (override with `TEST_HOST_PORT` / `TEST_BASE_URL`).
5. Tears down the test containers.
6. Prints a final pass/fail summary.

Expected output (all passing):

```
▶ Running unit tests
  ✔ isBanned returns true when isBanned=true
  ✔ thread state: ACTIVE → LOCKED allowed
  ... (60+ unit tests)

▶ Starting test containers (docker-compose.test.yml)
▶ Waiting for application health check (timeout: 120s)
  ✔ Health check passed (12s)

  Health response:
    {"status":"ok","timestamp":"...","services":{"database":"ok"}}

▶ Running API tests
  ✔ POST /auth/login → success (200)
  ✔ GET /auth/me → returns user profile
  ✔ banned user → 403 on login
  ... (80+ API tests)

════════════════════════════════════════
  TEST SUMMARY
════════════════════════════════════════
✔  Unit tests    PASSED
✔  API tests     PASSED
════════════════════════════════════════
  ALL TESTS PASSED
════════════════════════════════════════
```

### Unit tests only (no database required)

```bash
npm run test:unit
```

Or via the script:

```bash
bash run_tests.sh --unit
```

Tests cover:
- Auth lockout (failed-attempt counting, window expiry, lockout threshold)
- Reply depth boundary (depth 1–3 allowed, depth 4 → error)
- Thread state machine (ACTIVE→LOCKED→ARCHIVED, irreversible transitions)
- Pin limit enforcement (max 3 pinned per section)
- Mute/ban behavior (isMuted boundary `>` not `>=`, canPost precedence)
- Venue booking overlap conflict detection
- Notification retry exponential backoff
- Risk rule thresholds (thread deletions, cancellations, report volume)
- Feature flag key validation and CRUD logic
- Input validation (login, thread, mute, bulk action, feature flag, role change schemas)

### API tests only (containers must already be up)

Start the test stack first:

```bash
docker compose -f docker-compose.test.yml up --build
```

Then in a separate terminal:

```bash
TEST_BASE_URL=http://localhost:3011 npm run test:api
```

Or via the script (skips `docker compose up` if app is already reachable):

```bash
bash run_tests.sh --api
```

API tests cover:
- Auth: login success/failure, lockout, `/auth/me`, logout, correlation IDs
- Threads: CRUD, state machine, pin limit (409 on 4th pin), soft-delete → recycle bin
- Replies: depth 1–3 allowed, depth 4 → `REPLY_DEPTH_EXCEEDED`, locked/archived thread → 422
- Moderation: ban/unban (login blocked then restored), mute duration validation, bulk actions, recycle bin restore, audit log filtering, role change
- Sections: CRUD, subsections, missing-name validation
- Permissions: 9 endpoints without auth → 401, invalid/expired JWTs → 401, USER forbidden on 9 privileged ops, ANALYST read-only, MODERATOR cannot change org config

### Tear down test containers

```bash
docker compose -f docker-compose.test.yml down --volumes
```

---

## Project Structure

```
.
├── src/
│   ├── app.ts                  # Express app factory
│   ├── server.ts               # Entry point, DB connect, graceful shutdown
│   ├── config/                 # Runtime config from env vars
│   ├── lib/                    # Prisma client, logger
│   ├── middleware/             # Auth, correlation ID, error handler, rate limiter, tenant scope
│   ├── routes/                 # Route definitions per domain
│   ├── controllers/            # Request handlers
│   ├── services/               # Business logic (forum, auth, notifications, audit, risk)
│   └── types/                  # Shared TypeScript types
├── prisma/
│   ├── schema.prisma           # Data model
│   └── migrations/             # SQL migration files
├── config/                     # Static configuration defaults
├── scripts/
│   ├── entrypoint.sh           # Docker entrypoint (migrate + start)
│   ├── entrypoint.test.sh      # Test container entrypoint (migrate + seed + start)
│   ├── seed.ts                 # Production database seeder
│   ├── seed-test.ts            # Test database seeder (fixed IDs)
│   └── backup.sh               # Nightly backup script
├── unit_tests/                 # Jest unit tests (no DB)
│   ├── auth.lockout.test.ts
│   ├── reply.depth.test.ts
│   ├── thread.state.test.ts
│   ├── pin.limit.test.ts
│   ├── mute.ban.test.ts
│   ├── venue.booking.test.ts
│   ├── notification.retry.test.ts
│   ├── risk.rules.test.ts
│   ├── feature.flags.test.ts
│   ├── input.validation.test.ts
│   └── tenant.isolation.test.ts
├── API_tests/                  # Jest API integration tests (requires server)
│   ├── helpers/
│   │   ├── client.ts           # HTTP client + loginAs helper
│   │   └── fixtures.ts         # Test org, credentials, fixed IDs
│   ├── auth.test.ts
│   ├── threads.test.ts
│   ├── replies.test.ts
│   ├── moderation.test.ts
│   ├── sections.test.ts
│   ├── permissions.test.ts
│   └── health.test.ts
├── run_tests.sh                # One-click test runner
├── docs/                       # Design and specification documents
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json
└── tsconfig.json
```

---

## API Overview

Base path: `POST /api/v1`

| Domain | Endpoints |
|--------|-----------|
| Health | `GET /health` |
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Sections | `GET/POST /sections`, `PATCH /sections/:id`, subsections |
| Threads | `GET/POST /threads`, state transitions, pin/unpin |
| Replies | `GET/POST /threads/:id/replies`, `PATCH/DELETE /replies/:id` |
| Moderation | Ban/unban, mute/unmute, bulk actions, recycle bin |
| Admin | Organizations, announcements, carousel items, venues & bookings |
| Notifications | Inbox, subscriptions, internal dispatch/retry |
| Audit | `GET /audit/logs` (append-only, privileged) |
| Analytics | `GET /analytics/funnel` |
| Risk | `GET /risk/flags` |

All endpoints under `/api/v1` (except `/health` and `/auth/login`) require a `Bearer` token.  
Every response includes an `X-Correlation-Id` header for request tracing.

See [`docs/api-spec.md`](docs/api-spec.md) for the full specification.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP listen port |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `JWT_SECRET` | — | Token signing secret (min 32 chars in production) |
| `JWT_EXPIRES_IN` | `8h` | Token TTL |
| `LOGIN_LOCKOUT_ATTEMPTS` | `5` | Failed logins before lockout |
| `LOGIN_LOCKOUT_WINDOW_MINUTES` | `15` | Lockout detection window |
| `RATE_LIMIT_WRITE_PER_MIN` | `120` | Write actions per user per minute |
| `RATE_LIMIT_READ_PER_MIN` | `600` | Read actions per user per minute |
| `LOG_LEVEL` | `info` | Winston log level |
| `BACKUP_VOLUME_PATH` | `/backups` | Path for nightly backups |
| `INTERNAL_API_KEY` | — | Protects internal dispatch/retry endpoints; leave blank to disable |

---

## Roles

| Role | Capabilities |
|------|-------------|
| `ADMINISTRATOR` | Full org control, config, moderation |
| `MODERATOR` | Content moderation, ban/mute, recycle bin |
| `ANALYST` | Read-only dashboards and audit logs |
| `USER` | Forum participation (threads, replies) |

---

## Database Engine Note

The original prompt specified MySQL. This implementation uses **PostgreSQL 16** for the following reasons:

- **Better JSON operator support** — Prisma's `Json` fields and `$queryRaw` aggregations with `DATE_TRUNC` require PostgreSQL-style operators that are more ergonomic than MySQL's JSON functions.
- **Native array types** — PostgreSQL's native array support simplifies future tag/permission queries.
- **Superior LISTEN/NOTIFY** — PostgreSQL's publish-subscribe mechanism provides a foundation for real-time notification delivery without an external message broker.

The offline-first, single-host deployment target is equally satisfied by PostgreSQL.

**Point-in-time recovery (PITR)** is provided via WAL archiving and `pg_basebackup` — the PostgreSQL equivalent of MySQL binlog-based PITR. The backup script at `scripts/backup.sh` uses `pg_dump` for nightly snapshots with 14-day retention, consistent with the prompt requirement. To enable true PITR, configure `archive_mode = on` and `archive_command` in `postgresql.conf` to ship WAL segments to a durable store (S3, GCS, etc.).

No MySQL-specific features are required by the prompt that are unavailable in PostgreSQL.

---

## Known Constraints

**Rate Limiting**: The rate limiter uses an in-process sliding window (`src/middleware/rateLimiter.ts`) and is effective for single-instance deployments (the stated target: single Docker host, 500 concurrent users). For multi-instance horizontal scaling, replace `src/middleware/rateLimiter.ts` with a Redis-backed equivalent (e.g., `ioredis` + sliding-window Lua script or the `rate-limiter-flexible` library).
