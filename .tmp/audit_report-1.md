# CivicForum Operations Platform Static Audit

## 1. Verdict
- Overall conclusion: **Partial Pass**

## 2. Scope and Static Verification Boundary
- Reviewed: repository structure, README/config manifests, Docker manifests, Prisma schema, entrypoints, middleware, routes, controllers, services, repositories, unit/API test files, logging, backup script, and seed logic.
- Not reviewed: runtime behavior under a live MySQL instance, container orchestration behavior, actual request/response execution, scheduler timing, backup restoration, PITR recovery, or performance under load.
- Intentionally not executed: project startup, Docker, tests, migrations, HTTP calls, schedulers, backups.
- Manual verification required for: real startup success, health checks, container health sequencing, database migrations, actual backup restore/PITR, scheduler execution, performance targets, and any claim that depends on timing or concurrency beyond static code/tests.

## 3. Repository / Requirement Mapping Summary
- Prompt core goal: an offline-first, multi-tenant forum backend with auth, moderation, auditable config/content operations, in-app notifications, analytics, local backups, and local-only risk/alerting.
- Main implementation areas mapped: Express entrypoints and routing (`src/app.ts`, `src/routes/*`), auth/RBAC/multi-tenancy (`src/middleware/*`, `src/services/auth.service.ts`), forum/moderation/admin business logic (`src/services/*.ts`), persistence model (`prisma/schema.prisma`), background jobs/backups (`src/jobs/scheduler.ts`, `scripts/backup.sh`), and test coverage (`unit_tests`, `API_tests`).
- Main static gaps found: insecure documented default deployment, inconsistent organization-management authority, restore-path business-rule bypass, incomplete audit immutability evidence, and several validation/coverage gaps.

## 4. Section-by-section Review

### 4.1 Hard Gates
#### 1.1 Documentation and static verifiability
- Conclusion: **Pass**
- Rationale: README documents startup, health checks, tests, env vars, roles, and project structure; entrypoints and manifests are statically consistent with the documented Docker-based flow.
- Evidence: `README.md:7`, `README.md:95`, `README.md:201`, `docker-compose.yml:21`, `scripts/entrypoint.sh:1`, `package.json:1`
- Manual verification note: runtime startup and health behavior still require manual execution.

#### 1.2 Material deviation from the Prompt
- Conclusion: **Partial Pass**
- Rationale: the repository is centered on the prompt, but several prompt-level expectations are weakened: organization management authority is inconsistent, audit-log immutability is not enforced at schema level, and PITR support is documented rather than delivered/configured.
- Evidence: `src/services/admin.service.ts:28`, `src/services/admin.service.ts:36`, `src/services/admin.service.ts:64`, `prisma/schema.prisma:321`, `README.md:255`, `scripts/backup.sh:6`

### 4.2 Delivery Completeness
#### 2.1 Coverage of explicit core requirements
- Conclusion: **Partial Pass**
- Rationale: core auth, forum, moderation, notifications, analytics, feature-flag config, and backup snapshot flows are implemented. Gaps remain around immutable append-only audit storage, PITR delivery, and some admin/config edge validation.
- Evidence: `src/routes/auth.routes.ts:9`, `src/routes/threads.routes.ts:18`, `src/routes/replies.routes.ts:17`, `src/routes/moderation.routes.ts:17`, `src/routes/admin.routes.ts:23`, `src/routes/feature-flags.routes.ts:18`, `src/routes/notifications.routes.ts:19`, `src/routes/analytics.routes.ts:18`, `scripts/backup.sh:6`, `prisma/schema.prisma:321`

#### 2.2 End-to-end deliverable vs partial/demo
- Conclusion: **Pass**
- Rationale: this is a complete service-shaped repository with documentation, schema, routes, services, Docker manifests, seed logic, and tests; it is not a code fragment or illustrative sample.
- Evidence: `README.md:7`, `package.json:1`, `prisma/schema.prisma:1`, `src/server.ts:1`, `docker-compose.yml:1`, `run_tests.sh:1`

### 4.3 Engineering and Architecture Quality
#### 3.1 Structure and module decomposition
- Conclusion: **Pass**
- Rationale: the codebase uses a clear route/controller/service/repository split, isolated middleware, pure-rule helpers, and domain-specific modules at an appropriate scale.
- Evidence: `src/routes/index.ts:1`, `src/controllers/threads.controller.ts:1`, `src/services/forum.service.ts:1`, `src/repositories/thread.repository.ts:1`, `src/lib/thread-state.ts:1`

#### 3.2 Maintainability and extensibility
- Conclusion: **Partial Pass**
- Rationale: most core logic is maintainable, but there are notable architectural shortcuts: operational config is overloaded into `FeatureFlag.description`, audit append-only is enforced by convention rather than schema/DB, and organization management lacks a coherent authority model.
- Evidence: `src/services/org-config.service.ts:1`, `src/repositories/feature-flag.repository.ts:18`, `src/repositories/audit.repository.ts:27`, `src/services/admin.service.ts:28`

### 4.4 Engineering Details and Professionalism
#### 4.1 Error handling, logging, validation, API design
- Conclusion: **Partial Pass**
- Rationale: global error handling, structured logs, Zod validation, correlation IDs, and many business-rule checks are present. However, some API edges are weak: carousel time windows are not validated, notification open silently succeeds on unknown/non-owned IDs, and default deployment docs expose insecure defaults.
- Evidence: `src/middleware/errorHandler.ts:1`, `src/lib/logger.ts:1`, `src/middleware/correlationId.ts:4`, `src/schemas/admin.schema.ts:42`, `src/controllers/notifications.controller.ts:26`, `src/repositories/notification.repository.ts:66`, `README.md:44`, `docker-compose.yml:36`

#### 4.2 Product/service realism vs demo quality
- Conclusion: **Pass**
- Rationale: the repository resembles a real backend service with tenant-aware persistence, role guards, audit/event tables, background jobs, and static tests spanning major flows.
- Evidence: `prisma/schema.prisma:38`, `src/jobs/scheduler.ts:105`, `API_tests/auth.test.ts:11`, `API_tests/tenant-isolation.test.ts:1`

### 4.5 Prompt Understanding and Requirement Fit
#### 5.1 Business-goal and constraint fit
- Conclusion: **Partial Pass**
- Rationale: the implementation broadly fits the forum/moderation/configuration/auditing use case, but some prompt constraints are only partially met or under-proven: immutable audit storage, PITR delivery, and consistent organization-management semantics.
- Evidence: `src/services/forum.service.ts:35`, `src/services/moderation.service.ts:17`, `src/services/notification.service.ts:1`, `src/services/analytics.service.ts:1`, `prisma/schema.prisma:321`, `README.md:255`

### 4.6 Aesthetics
#### 6.1 Frontend-only / full-stack visual quality
- Conclusion: **Not Applicable**
- Rationale: repository is backend-only; no frontend/UI was present in the reviewed scope.
- Evidence: `README.md:3`, `src/server.ts:1`

## 5. Issues / Suggestions (Severity-Rated)

### High
#### 1. Insecure default deployment path exposes known admin credentials and known secrets
- Conclusion: **High**
- Evidence: `README.md:21`, `README.md:46`, `docker-compose.yml:31`, `docker-compose.yml:36`, `docker-compose.yml:43`, `scripts/seed.ts:18`
- Impact: the primary documented startup path runs in `development` with a predictable JWT secret, predictable internal API key, and a seeded `admin/admin-password-secure` account. If this stack is exposed beyond a trusted local environment, authentication and internal-job protection are materially weakened.
- Minimum actionable fix: split dev-only defaults from deployment defaults; require explicit secret/env overrides for any documented startup path; do not publish static admin credentials as the default operational login; force first-run credential rotation or disable seed admin outside test/dev.

#### 2. Organization-management authority model is inconsistent and unsafe
- Conclusion: **High**
- Evidence: `src/routes/admin.routes.ts:24`, `src/services/admin.service.ts:28`, `src/services/admin.service.ts:36`, `src/services/admin.service.ts:64`
- Impact: any tenant `ADMINISTRATOR` can create a new global `Organization`, but listing/updating is scoped back to the caller’s own org. This is neither clean tenant-scoped admin nor explicit platform-admin behavior, and it creates cross-tenant authority not justified by the prompt.
- Minimum actionable fix: define a platform-admin role for organization CRUD, or fully scope organization management to the caller’s own organization and remove tenant-admin creation of arbitrary orgs.

#### 3. Recycle-bin restore bypasses the pinned-thread limit
- Conclusion: **High**
- Evidence: `src/services/moderation.service.ts:237`, `src/services/moderation.service.ts:252`, `src/services/forum.service.ts:183`
- Impact: thread restoration directly clears `deletedAt` without rechecking section pin count. A previously pinned deleted thread can be restored into a section that already has the configured maximum, violating the “pinned limited to 3 per section” rule.
- Minimum actionable fix: on restore of a pinned thread, re-evaluate the section pin limit in a transaction before clearing `deletedAt`, or automatically unpin restored threads when the section is at capacity.

### Medium
#### 4. Audit-log immutability is not enforced at schema/storage level, and the required `auditLogId` is absent
- Conclusion: **Medium**
- Evidence: `prisma/schema.prisma:321`, `src/repositories/audit.repository.ts:27`, `README.md:215`
- Impact: append-only behavior is implemented by repository convention, not by database constraints, and the prompt’s explicit `auditLogId` requirement is not present. Direct Prisma writes or future code changes could violate audit immutability without schema resistance.
- Minimum actionable fix: add an explicit immutable audit identifier field if required by contract, and enforce append-only behavior through DB policy/triggers/restricted DB permissions or a stricter write model.

#### 5. Failed login activity is not part of the auditable operation-log stream
- Conclusion: **Medium**
- Evidence: `src/services/auth.service.ts:55`, `src/services/auth.service.ts:73`, `prisma/schema.prisma:75`
- Impact: successful logins are written to `AuditLog`, but failed logins are only stored in `LoginAttempt`. This weakens the prompt requirement for auditable login operations and fragments operational review across separate stores.
- Minimum actionable fix: add audited login-failure events, or explicitly expose/login-attempt history in a privileged audit view with retention and query controls.

#### 6. Carousel items accept invalid `startAt` / `endAt` ranges
- Conclusion: **Medium**
- Evidence: `src/schemas/admin.schema.ts:42`, `src/services/admin.service.ts:206`, `src/services/admin.service.ts:233`
- Impact: unlike announcements, carousel items have no validation that `endAt > startAt`, so invalid scheduling windows can be persisted and later interpreted inconsistently.
- Minimum actionable fix: add the same date-order refinement used for announcements to carousel create/update schemas.

#### 7. Notification “open” endpoint returns success even when the notification does not exist or is not owned by the caller
- Conclusion: **Medium**
- Evidence: `src/controllers/notifications.controller.ts:26`, `src/repositories/notification.repository.ts:66`
- Impact: `updateMany` is used without checking the affected row count, so clients receive `200` for nonexistent IDs or IDs they do not own. This hides authorization/not-found errors and weakens traceability of notification state transitions.
- Minimum actionable fix: return the affected row count from the repository and emit `404` when nothing was updated.

#### 8. PITR/binlog support is documented but not actually delivered/configured in the supplied deployment
- Conclusion: **Medium**
- Evidence: `README.md:255`, `scripts/backup.sh:8`, `docker-compose.yml:10`
- Impact: the repository provides dump backups and documents how to enable binlog/PITR elsewhere, but the included MySQL service does not enable binlog. The prompt asked for PITR support “where available”; this is only partially satisfied.
- Minimum actionable fix: either ship a MySQL config that enables binlog/PITR in the provided deployment or explicitly narrow the deliverable claim to snapshot backups only.

### Low
#### 9. Some “unit” tests duplicate logic instead of exercising production code
- Conclusion: **Low**
- Evidence: `unit_tests/internal-auth.test.ts:13`, `unit_tests/log.redaction.test.ts:11`, `unit_tests/notification.retry.test.ts:22`, `unit_tests/risk.rules.test.ts:23`
- Impact: these tests can continue passing even if production middleware/service implementations regress, reducing the value of the static test suite for high-risk areas.
- Minimum actionable fix: import and test production modules directly where possible, or add thin testable wrappers around currently hard-to-import code.

## 6. Security Review Summary
- Authentication entry points: **Pass**. Login uses validated username/password, bcrypt comparison, lockout thresholds from DB config, JWT signing, revocation, and per-request DB refresh of user state. Evidence: `src/routes/auth.routes.ts:9`, `src/services/auth.service.ts:15`, `src/middleware/auth.ts:22`.
- Route-level authorization: **Pass**. Protected routes consistently layer `authenticate`, `tenantScope`, rate limits, and `requireRole` where needed. Evidence: `src/routes/threads.routes.ts:17`, `src/routes/moderation.routes.ts:17`, `src/routes/admin.routes.ts:23`, `src/routes/analytics.routes.ts:14`.
- Object-level authorization: **Pass**. Threads/replies enforce owner-or-mod/admin checks before update/delete. Evidence: `src/services/forum.service.ts:126`, `src/services/forum.service.ts:322`, `src/services/forum.service.ts:433`, `API_tests/object-auth.test.ts:24`.
- Function-level authorization: **Partial Pass**. Most service methods assume route guards correctly, but organization creation exposes broader authority than the rest of the org-management surface. Evidence: `src/services/admin.service.ts:36`, `src/services/admin.service.ts:64`.
- Tenant / user isolation: **Pass**. Major reads/writes are org-scoped, and thread creation verifies referenced section/subsection/tag ownership. Evidence: `src/services/forum.service.ts:44`, `src/repositories/thread.repository.ts:46`, `src/services/section.service.ts:64`, `API_tests/tenant-isolation.test.ts:47`.
- Admin / internal / debug protection: **Partial Pass**. Internal endpoints are protected by `x-internal-key`, but the default compose file ships a predictable development key; admin surfaces are otherwise guarded. Evidence: `src/routes/internal.routes.ts:13`, `src/middleware/internalAuth.ts:16`, `docker-compose.yml:43`.

## 7. Tests and Logging Review
- Unit tests: **Partial Pass**. Unit tests exist and cover several pure business rules well, but some high-risk areas use duplicated test logic instead of production imports. Evidence: `package.json:37`, `unit_tests/thread.state.test.ts:6`, `unit_tests/internal-auth.test.ts:13`, `unit_tests/log.redaction.test.ts:11`.
- API / integration tests: **Pass**. API tests exist for auth, permissions, tenant isolation, thread/reply flows, moderation, feature flags, notifications, and real-time auth invalidation. Evidence: `API_tests/auth.test.ts:11`, `API_tests/permissions.test.ts:1`, `API_tests/tenant-isolation.test.ts:1`, `API_tests/realtime-auth.test.ts:1`.
- Logging categories / observability: **Pass**. Structured logging, correlation IDs, masked fields, error logging, and alert-threshold hooks are present. Evidence: `src/app.ts:20`, `src/lib/logger.ts:1`, `src/middleware/errorHandler.ts:28`, `src/middleware/correlationId.ts:4`, `src/jobs/log-alert.ts:1`
- Sensitive-data leakage risk in logs / responses: **Partial Pass**. Password/token/email/IP redaction is implemented, and auth responses omit `passwordHash`; however, the default deployment path still exposes seeded credentials in documentation rather than through logs, and some redaction tests do not prove the production logger directly. Evidence: `src/lib/logger.ts:31`, `src/controllers/auth.controller.ts:77`, `README.md:46`, `unit_tests/log.redaction.test.ts:11`.

## 8. Test Coverage Assessment (Static Audit)

### 8.1 Test Overview
- Unit tests exist under `unit_tests`, API/integration tests exist under `API_tests`, both using Jest via `ts-jest`. Evidence: `package.json:13`, `package.json:37`, `README.md:95`
- Test entry points are `npm run test:unit`, `npm run test:api`, and `bash run_tests.sh`. Evidence: `package.json:13`, `run_tests.sh:1`, `README.md:101`
- Documentation provides explicit test commands, but static audit does not confirm they pass. Evidence: `README.md:99`, `README.md:142`, `README.md:160`

### 8.2 Coverage Mapping Table
| Requirement / Risk Point | Mapped Test Case(s) | Key Assertion / Fixture / Mock | Coverage Assessment | Gap | Minimum Test Addition |
|---|---|---|---|---|---|
| Auth login/logout/token revocation | `API_tests/auth.test.ts:11` | success, 401s, logout, revoked token checks at `API_tests/auth.test.ts:163` | sufficient | runtime still unverified | none beyond manual execution |
| Route authorization / 401 / 403 | `API_tests/permissions.test.ts:34` | unauthenticated 401 and role-based 403 checks | sufficient | no direct coverage of every endpoint | add a route inventory test if strict completeness is required |
| Object-level authorization | `API_tests/object-auth.test.ts:24` | owner vs non-owner vs moderator on thread/reply update/delete | sufficient | none major | none |
| Tenant isolation | `API_tests/tenant-isolation.test.ts:47` | cross-org section/subsection/tag creation blocked | sufficient | no explicit cross-org booking/admin read tests | add admin-resource cross-tenant tests |
| Thread state machine / pin limit | `API_tests/threads.test.ts:180`, `API_tests/db-config.test.ts:30` | invalid transitions and pin-limit 409 | basically covered | restore-path pin-limit bypass not covered | add recycle-bin restore test for pinned thread overflow |
| Reply depth / locked-archived behavior | `API_tests/replies.test.ts:57` | depth 4 rejected, locked/archived thread rejects replies | sufficient | restore-path reply edge cases absent | add reply restore into archived/deleted parent cases |
| Moderation real-time enforcement | `API_tests/realtime-auth.test.ts:26` | old token invalidated after ban/mute/role change | sufficient | function-level org-admin edge not covered | add organization-management authorization tests |
| Notifications / subscriptions / internal endpoints | `API_tests/notifications.test.ts:25` | inbox/subscriptions/internal key positive+negative | basically covered | no test for `open` not-found/ownership behavior | add `POST /notifications/:id/open` 404/ownership cases |
| Logging redaction | `unit_tests/log.redaction.test.ts:55` | duplicated masking logic assertions | insufficient | does not exercise production logger implementation directly | test `src/lib/logger.ts` exports or integration log formatting directly |
| Internal auth middleware | `unit_tests/internal-auth.test.ts:6` | duplicated expectations only | insufficient | no direct execution of production middleware | import middleware or add API-level tests for wrong-length/wrong-value keys |
| Risk rules | `API_tests/thread-report.test.ts:95`, `unit_tests/risk.rules.test.ts:21` | report-driven flag creation, pure threshold logic | basically covered | unit tests duplicate logic, not service internals | add targeted service-level tests around existing-open-flag update behavior |
| Admin config scheduling validation | none for invalid carousel time window | announcements validated, carousel not exercised | missing | invalid `startAt/endAt` window can persist | add create/update carousel invalid-range tests |

### 8.3 Security Coverage Audit
- Authentication: **Meaningfully covered**. Login success/failure, `/auth/me`, logout, malformed/expired tokens, and token revocation are exercised. Evidence: `API_tests/auth.test.ts:11`
- Route authorization: **Meaningfully covered**. Protected endpoints and role restrictions are tested across USER/ANALYST/MODERATOR. Evidence: `API_tests/permissions.test.ts:85`
- Object-level authorization: **Meaningfully covered**. Threads and replies cover owner/non-owner/moderator paths. Evidence: `API_tests/object-auth.test.ts:24`
- Tenant / data isolation: **Meaningfully covered for core forum resources**. Cross-org section/subsection/tag and read isolation are tested. Evidence: `API_tests/tenant-isolation.test.ts:47`
- Admin / internal protection: **Partially covered**. Internal endpoints are checked for key presence, but unit tests do not exercise the real middleware and there is no coverage for insecure documented defaults. Evidence: `API_tests/notifications.test.ts:65`, `unit_tests/internal-auth.test.ts:6`

### 8.4 Final Coverage Judgment
- **Partial Pass**
- Major risks covered: auth flows, RBAC, object ownership, tenant isolation for core forum resources, thread/reply constraints, and real-time token invalidation.
- Major uncovered risks: organization-management authority, recycle-bin restore rule bypass, invalid carousel scheduling windows, notification-open ownership/not-found handling, and true production-code coverage for some logging/internal-auth/risk unit tests. Tests could still pass while those defects remain.

## 9. Final Notes
- Static evidence supports that this is a substantial backend delivery aligned to the prompt.
- The strongest acceptance risks are security/authority related rather than missing broad feature areas.
- No runtime-success claim is made in this audit; all runtime-dependent points remain manual verification items.
