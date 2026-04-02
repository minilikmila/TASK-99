# CivicForum Operations Platform Design

## 1. Overview

This document defines the technical design for an offline-first, multi-tenant forum backend serving civic/community organizations.
The service runs as a single deployable Express + TypeScript application with Prisma + MySQL persistence and local-only dependencies.

## 2. Goals and Constraints

### 2.1 Goals

- Provide robust forum operations: threads, replies, moderation, and admin configuration
- Enforce strict tenant isolation (`organizationId`) across all user-generated data
- Deliver auditable operations, local notifications, risk detection, and analytics
- Support offline deployment without external services

### 2.2 Constraints

- No third-party integrations (no external email, SMS, WeChat, analytics, Redis)
- Single-host deployment target (Docker)
- Security-focused logging and data handling
- Append-only immutable audit logs

## 3. Architecture

### 3.1 Logical Components

- **API Layer (Express)**: REST controllers, request validation, error mapping
- **Auth & Access Control**: login/session/token verification, role checks, tenant resolution
- **Domain Services**:
  - Forum Content Service
  - Moderation Service
  - Admin Configuration Service
  - Notification Service
  - Audit & Analytics Service
  - Risk Detection Service
- **Data Layer (Prisma)**: transactional writes, scoped reads, repository helpers
- **Scheduler/Jobs**: notification dispatch/retries, nightly backup trigger, risk rule scans

### 3.2 Deployment

- One containerized service process
- MySQL database (local network)
- Attached local volume for backups
- Optional local process manager for cron/scheduled jobs inside container or sidecar

## 4. Security and Access Model

### 4.1 Authentication

- Username/password login per organization
- Password policy: minimum 12 characters
- Account lockout: 5 failed attempts in 15 minutes
- Password storage: salted secure hash (Argon2id or bcrypt with strong cost)

### 4.2 Authorization

- Role-based access (Administrator, Moderator, Analyst, User)
- Route-level permission guards plus service-level authorization checks
- Analysts are read-only and strictly org-scoped

### 4.3 Tenant Isolation

- Tenant context resolved from authenticated principal
- All reads/writes enforce `organizationId` filters
- Composite indexes include `organizationId` for key entities
- No cross-tenant access in v1

### 4.4 Data Protection and Logging

- Encrypt sensitive optional fields at rest (for example, email if stored)
- Mask personal identifiers in structured logs
- Include correlation IDs for tracing request flow

## 5. Domain Model (High-Level)

Core entities:

- `Organization`
- `User` (role, status fields `isBanned`, `muteUntil`)
- `Section`, `Subsection`
- `Tag` (flat taxonomy, unique slug per org)
- `Thread` (state, pinned/featured)
- `Reply` (parent reply, depth <= 3)
- `RecycleBinItem`
- `Announcement`, `CarouselItem`
- `Venue`, `VenueBooking`
- `Notification`, `NotificationSubscription`, `NotificationDeliveryAttempt`
- `AuditLog` (append-only)
- `EventLog` (for analytics)
- `RiskFlag`
- `FeatureFlag`
- `LoginAttempt`

## 6. Key Business Rules

- Replies nesting depth > 3 is rejected
- Thread transitions:
  - `active -> locked -> archived`
  - `active -> archived`
  - No rollback from archived
- Locked thread blocks new replies
- Archived thread blocks edits and replies
- Pinned threads capped at 3 per section (4th pin rejected)
- Ban blocks login; mute blocks thread/reply creation
- Bulk moderation request max 100 items, per-item audit entries
- Recycle bin retention 30 days; restore fails on dependency conflicts
- Venue booking conflicts by overlapping ranges in same room

## 7. Data Storage and Indexing

### 7.1 Multi-Tenant Indexing

For user-generated tables, include:

- `organizationId`
- composite index `(organizationId, id)` or `(organizationId, <business_key>)`

Examples:

- `User`: unique `(organizationId, username)`
- `Tag`: unique `(organizationId, slug)`
- `Thread`: index `(organizationId, sectionId, state, createdAt desc)`
- `Reply`: index `(organizationId, threadId, parentReplyId, createdAt)`

### 7.2 Immutability

- `AuditLog` table is append-only by design
- No update/delete APIs for audit records
- DB permissions can additionally deny update/delete on audit table

## 8. Service Workflows

### 8.1 Content Write Path

1. Authenticate and resolve tenant
2. Authorize role/ownership
3. Validate state constraints (locked/archived/depth/pin limits)
4. Persist transaction via Prisma
5. Write audit log entry
6. Emit local domain event for notifications and analytics

### 8.2 Notifications

- Event-triggered: new reply, moderation action, announcement publish
- Scheduled jobs enqueue due notifications
- Delivery is in-app only
- Retry failed deliveries up to 3 times with exponential backoff within 24h
- Subscription controls by category; security notices default opt-in

### 8.3 Risk Detection

- Rule engine periodically scans recent event windows
- Creates `RiskFlag` records for moderator review
- No automatic punitive actions in v1

## 9. Analytics and Reporting

- Store first-party `EventLog` records (e.g., `thread_view`, `user_registered`, `post_created`, `engagement`)
- Compute forum funnel aggregates (`view -> registration -> post -> engagement`) from local data
- Analyst role can query dashboards read-only

## 10. Rate Limiting and Performance

- Local in-memory sliding window per user:
  - writes: 120/min
  - reads: 600/min
- Accept single-instance limitation (no distributed consistency requirement)
- Performance objective: p95 reads <300ms at 500 concurrent users
- Optimize with targeted indexes, keyset/cursor paging where relevant, and shallow eager loading

## 11. Backup and Recovery

- Nightly backups to attached local volume
- Retain 14 days
- Prefer logical + binary log strategy where available
- Support point-in-time recovery (PITR) from binlogs

## 12. Config and Feature Flags

- Feature flags stored in DB
- All flag changes audited
- Runtime cache with short TTL and explicit invalidation on update

## 13. API and Validation Strategy

- OpenAPI-style contracts per module
- Request validation (zod/class-validator style) at boundary
- Unified error schema with machine-readable codes
- Idempotency support for selected write endpoints via optional `Idempotency-Key`

## 14. Testing Strategy

- Unit tests: domain rules and state transitions
- Integration tests: API + DB path for tenant isolation and auth
- Scenario tests:
  - lockout behavior
  - nested reply depth rejection
  - pin-limit enforcement
  - archive immutability
  - notification retry progression
  - risk flag generation thresholds
  - booking overlap rejection

## 15. Open Decisions Captured from Clarifications

Implemented assumptions from `questions.md`:

- No cross-tenant reads
- Reply depth hard reject at >3
- Archived state irreversible
- 4th pinned thread rejected
- Flat tags in v1
- Ban and mute behaviors separated
- Bulk actions are final, audited per item
- Restore blocked on missing dependencies
- Retry failure means "not delivered"
- Offline conflict baseline is last-write-wins using timestamps
- Risk detections create flags only
- Event logging explicitly modeled for dashboard metrics
