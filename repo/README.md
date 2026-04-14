# CivicForum Operations Platform

Offline-first, multi-tenant civic forum backend — Express + TypeScript + Prisma + MySQL.

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
cd repo && docker compose up --build
```

> No `.env` file is required — development defaults are built into `docker-compose.yml`.
> See `.env.example` for the full list of available environment variables.
> In production, supply secrets (`JWT_SECRET`, `INTERNAL_API_KEY`) via your deployment system.

This command:
1. Builds the application image (installs npm deps, generates Prisma client, compiles TypeScript).
2. Starts MySQL (`db` service) and waits for its health check to pass.
3. Runs `prisma migrate deploy` to apply all migrations.
4. Seeds default data (`default-org` + admin user) automatically (idempotent). In development/test, a default admin is created. In production, set `ADMIN_USERNAME` and `ADMIN_PASSWORD` to bootstrap the first admin.
5. Starts the Express server on port **3000**.

> First build takes ~2–3 minutes. Subsequent starts are much faster.

---

## Verify the Service

### Health check

```bash
curl http://localhost:3000/api/v1/health
```

### Login right away (development only)

When running in `development` mode (`NODE_ENV=development`), a default admin account is seeded automatically:

- `organizationSlug`: `default-org`
- `username`: `admin`
- `password`: `admin-password-secure`

> **Production bootstrap:** Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables before running `npm run seed` to provision the first administrator. The password must be at least 12 characters.

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
cd repo && docker compose ps
```

You should see both `app` and `db` with status `running`.

### View application logs

```bash
cd repo && docker compose logs -f app
```

---

## Stopping the Service

```bash
cd repo && docker compose down
```

To also remove the database volume (destroys all data):

```bash
cd repo && docker compose down -v
```

---

## Running Tests

All tests run fully inside Docker — no host-side Node.js, npm, or jest required.

### One-click (unit + API — recommended)

```bash
bash repo/run_tests.sh
```

This script:
1. Builds the test images.
2. Runs all unit tests inside a Docker container (no DB required).
3. Starts the DB and app containers, waits for health checks.
4. Runs all API tests inside a Docker container against the app.
5. Tears down all containers and volumes.
6. Prints a final pass/fail summary.

Expected output (all passing):

```
▶ Building test images
✔  Images built

▶ Running unit tests (containerized)
  ✔ isBanned returns true when isBanned=true
  ✔ thread state: ACTIVE → LOCKED allowed
  ... (60+ unit tests)
✔  Unit tests passed

▶ Running API tests (containerized — starting DB + app)
  ✔ POST /auth/login → success (200)
  ✔ GET /auth/me → returns user profile
  ✔ banned user → 403 on login
  ... (80+ API tests)
✔  API tests passed

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
bash repo/run_tests.sh --unit
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

### API tests only

```bash
bash repo/run_tests.sh --api
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
cd repo && docker compose -f docker-compose.test.yml --profile test down --volumes
```

---

## Project Structure

```
.
├── src/                      # Express app code
├── prisma/                   # Prisma schema + migrations
├── config/                   # Runtime defaults
    ├── scripts/                  # Docker entrypoints + seed + backup
├── unit_tests/              # Jest unit tests (no DB)
├── API_tests/               # Jest API integration tests (requires server)
├── run_tests.sh             # One-click test runner
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

---

## API Overview

Base path: `/api/v1`

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
Internal job endpoints (`/internal/notifications/*`, `/internal/risk/*`) use an `X-Internal-Key` header instead of a Bearer token.  
Every response includes an `X-Correlation-Id` header for request tracing.

Endpoint details are documented inline via Zod schemas in `src/schemas/`.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP listen port |
| `DATABASE_URL` | — | MySQL connection string |
| `JWT_SECRET` | — | Token signing secret (min 32 chars in production) |
| `JWT_EXPIRES_IN` | `8h` | Token TTL |
| `LOGIN_LOCKOUT_ATTEMPTS` | `5` | Failed logins before lockout |
| `LOGIN_LOCKOUT_WINDOW_MINUTES` | `15` | Lockout detection window |
| `RATE_LIMIT_WRITE_PER_MIN` | `120` | Write actions per user per minute |
| `RATE_LIMIT_READ_PER_MIN` | `600` | Read actions per user per minute |
| `LOG_LEVEL` | `info` | Winston log level |
| `BACKUP_VOLUME_PATH` | `/backups` | Path for nightly backups |
| `INTERNAL_API_KEY` | — | Required in production (>= 32 chars) for internal dispatch/retry endpoints |

---

## Roles

| Role | Capabilities |
|------|-------------|
| `ADMINISTRATOR` | Full org control, config, moderation |
| `MODERATOR` | Content moderation, ban/mute, recycle bin |
| `ANALYST` | Read-only dashboards and audit logs |
| `USER` | Forum participation (threads, replies) |

---

## Database Engine

This implementation uses **MySQL 8.0** as specified in the prompt. The backup script at `scripts/backup.sh` uses `mysqldump` for nightly snapshots with 14-day retention. **Point-in-time recovery (PITR)** is supported via MySQL's binary log (`binlog`). To enable PITR, configure `log_bin`, `binlog_format=ROW`, and set an appropriate `binlog_expire_logs_seconds` in the MySQL server configuration. For managed services (AWS RDS, GCP Cloud SQL, Azure Database for MySQL), enable the provider's automated PITR feature.

---

## Known Constraints

**Rate Limiting**: The rate limiter uses an in-process sliding window (`src/middleware/rateLimiter.ts`) and is effective for single-instance deployments (the stated target: single Docker host, 500 concurrent users). For multi-instance horizontal scaling, replace `src/middleware/rateLimiter.ts` with a Redis-backed equivalent (e.g., `ioredis` + sliding-window Lua script or the `rate-limiter-flexible` library).
