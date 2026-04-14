# CivicForum Operations Platform Static Audit Bugfix Verification

## 1. Verdict
- Overall conclusion: **Partial Pass**

## 2. Scope and Static Verification Boundary
- Reviewed: only the nine issues listed in `../.tmp/audit_report_2.md`.
- Not reviewed: any new or unrelated defects outside those previously listed issues.
- Intentionally not executed: project startup, Docker, tests, migrations, HTTP calls, schedulers, backups.
- Manual verification required for: any runtime behavior implied by configuration changes, backup/PITR behavior, and any behavior that depends on live request execution or database state.

## 3. Repository / Requirement Mapping Summary
- Source of truth for this review: the nine issues in `../.tmp/audit_report_2.md`.
- Verification method: static comparison of each prior issue against the current codebase and documentation.
- Result summary: issues 1, 2, and 3 are fixed; issues 4, 5, 6, 7, 8, and 9 remain unresolved.

## 4. Section-by-section Review

### 4.1 Hard Gates
#### 1.1 Documentation and static verifiability
- Conclusion: **Pass**
- Rationale: the previous documentation/default-deployment issue was partially addressed by requiring `.env` setup, requiring `JWT_SECRET` and `INTERNAL_API_KEY` in Compose, and clarifying that the seeded admin account is development-only.
- Evidence: `README.md:19`, `README.md:52`, `docker-compose.yml:34`, `docker-compose.yml:37`, `docker-compose.yml:44`, `scripts/seed.ts:27`

#### 1.2 Material deviation from the Prompt
- Conclusion: **Partial Pass**
- Rationale: one prior prompt-fit issue was fixed (organization-management authority), but audit immutability and PITR delivery remain unchanged.
- Evidence: `src/routes/admin.routes.ts:28`, `src/services/admin.service.ts:27`, `prisma/schema.prisma:351`, `README.md:265`, `scripts/backup.sh:8`

### 4.2 Delivery Completeness
#### 2.1 Coverage of explicit core requirements
- Conclusion: **Partial Pass**
- Rationale: the prior restore-path pin-limit defect is fixed, but audit immutability, failed-login audit coverage, carousel scheduling validation, notification-open handling, and PITR delivery are still not fixed.
- Evidence: `src/services/moderation.service.ts:254`, `prisma/schema.prisma:351`, `src/services/auth.service.ts:55`, `src/schemas/admin.schema.ts:42`, `src/controllers/notifications.controller.ts:26`, `README.md:265`

#### 2.2 End-to-end deliverable vs partial/demo
- Conclusion: **Pass**
- Rationale: unchanged from the prior report; this remains a complete service repository. The bugfix verification scope did not require re-evaluating unrelated deliverable completeness.
- Evidence: `README.md:7`, `src/server.ts:1`, `prisma/schema.prisma:1`

### 4.3 Engineering and Architecture Quality
#### 3.1 Structure and module decomposition
- Conclusion: **Pass**
- Rationale: unchanged by the verified fixes; no regression observed in the previously flagged areas.
- Evidence: `src/routes/admin.routes.ts:1`, `src/services/moderation.service.ts:229`, `src/repositories/audit.repository.ts:27`

#### 3.2 Maintainability and extensibility
- Conclusion: **Partial Pass**
- Rationale: organization-management authority was simplified and made coherent, but the audit/storage and test-duplication issues remain.
- Evidence: `src/routes/admin.routes.ts:28`, `src/repositories/audit.repository.ts:27`, `unit_tests/internal-auth.test.ts:13`, `unit_tests/log.redaction.test.ts:11`

### 4.4 Engineering Details and Professionalism
#### 4.1 Error handling, logging, validation, API design
- Conclusion: **Partial Pass**
- Rationale: the restore-path bug was corrected, but carousel window validation and notification-open success-on-noop behavior remain unchanged.
- Evidence: `src/services/moderation.service.ts:255`, `src/schemas/admin.schema.ts:42`, `src/controllers/notifications.controller.ts:26`, `src/repositories/notification.repository.ts:66`

#### 4.2 Product/service realism vs demo quality
- Conclusion: **Pass**
- Rationale: unchanged by the verified fixes; the repository still presents as a real service.
- Evidence: `src/jobs/scheduler.ts:105`, `src/services/auth.service.ts:15`

### 4.5 Prompt Understanding and Requirement Fit
#### 5.1 Business-goal and constraint fit
- Conclusion: **Partial Pass**
- Rationale: the organization-management and restore-path issues were fixed, but append-only audit enforcement, failed-login auditability, and PITR delivery remain only partially aligned to the prompt.
- Evidence: `src/routes/admin.routes.ts:28`, `src/services/moderation.service.ts:255`, `prisma/schema.prisma:351`, `src/services/auth.service.ts:55`, `README.md:265`

### 4.6 Aesthetics
#### 6.1 Frontend-only / full-stack visual quality
- Conclusion: **Not Applicable**
- Rationale: backend-only repository; unchanged.
- Evidence: `README.md:3`

## 5. Issues / Suggestions (Severity-Rated)

### Fixed
#### 1. Insecure default deployment path exposes known admin credentials and known secrets
- Conclusion: **Fixed**
- Evidence: `README.md:19`, `README.md:52`, `docker-compose.yml:37`, `docker-compose.yml:44`, `scripts/seed.ts:27`
- Impact: previously documented insecure defaults are no longer the primary startup path. Compose now requires `JWT_SECRET` and `INTERNAL_API_KEY`, and the seeded admin account is explicitly limited to development/test.
- Minimum actionable fix: none for this issue.

#### 2. Organization-management authority model is inconsistent and unsafe
- Conclusion: **Fixed**
- Evidence: `src/routes/admin.routes.ts:28`, `src/routes/admin.routes.ts:30`, `src/services/admin.service.ts:27`, `src/services/admin.service.ts:35`
- Impact: tenant API no longer exposes organization creation. Organization operations are now scoped to listing/updating the caller’s own organization only, which removes the prior cross-tenant authority mismatch.
- Minimum actionable fix: none for this issue.

#### 3. Recycle-bin restore bypasses the pinned-thread limit
- Conclusion: **Fixed**
- Evidence: `src/services/moderation.service.ts:254`, `src/services/moderation.service.ts:258`, `src/services/moderation.service.ts:269`, `src/services/moderation.service.ts:271`, `src/services/moderation.service.ts:315`
- Impact: restore now checks section pin capacity in a serializable transaction and auto-unpins the restored thread when necessary, preserving the pin-limit invariant.
- Minimum actionable fix: none for this issue.

### Not Fixed
#### 4. Audit-log immutability is not enforced at schema/storage level, and the required `auditLogId` is absent
- Conclusion: **Not Fixed**
- Evidence: `prisma/schema.prisma:351`, `prisma/schema.prisma:353`, `src/repositories/audit.repository.ts:27`
- Impact: append-only behavior is still by convention only, and there is still no `auditLogId` field added to the schema.
- Minimum actionable fix: add schema/storage-level immutability enforcement and the required explicit audit identifier if contractually required.

#### 5. Failed login activity is not part of the auditable operation-log stream
- Conclusion: **Not Fixed**
- Evidence: `src/services/auth.service.ts:23`, `src/services/auth.service.ts:55`, `src/services/auth.service.ts:73`
- Impact: failed logins are still recorded only in `LoginAttempt`; only successful logins are written to `AuditLog`.
- Minimum actionable fix: emit audit-log events for failed login attempts or otherwise unify failed-login visibility into the auditable operation-log stream.

#### 6. Carousel items accept invalid `startAt` / `endAt` ranges
- Conclusion: **Not Fixed**
- Evidence: `src/schemas/admin.schema.ts:42`, `src/schemas/admin.schema.ts:52`, `src/services/admin.service.ts:177`, `src/services/admin.service.ts:204`
- Impact: carousel create/update schemas still lack the `endAt > startAt` refinement that announcements already have.
- Minimum actionable fix: add date-order validation to carousel create/update schemas.

#### 7. Notification “open” endpoint returns success even when the notification does not exist or is not owned by the caller
- Conclusion: **Not Fixed**
- Evidence: `src/controllers/notifications.controller.ts:26`, `src/repositories/notification.repository.ts:66`
- Impact: controller still ignores affected-row count, and repository still uses `updateMany` without surfacing whether anything was updated.
- Minimum actionable fix: return the update count from the repository and emit `404` when no owned notification was updated.

#### 8. PITR/binlog support is documented but not actually delivered/configured in the supplied deployment
- Conclusion: **Not Fixed**
- Evidence: `README.md:265`, `scripts/backup.sh:8`, `docker-compose.yml:10`
- Impact: documentation still says PITR is supported via binlog, but the included MySQL Compose service still does not configure binlog or ship MySQL config for PITR.
- Minimum actionable fix: provide an actual MySQL configuration enabling binlog/PITR in the supplied deployment, or narrow the claim to dump backups only.

#### 9. Some “unit” tests duplicate logic instead of exercising production code
- Conclusion: **Not Fixed**
- Evidence: `unit_tests/internal-auth.test.ts:13`, `unit_tests/log.redaction.test.ts:11`, `unit_tests/notification.retry.test.ts:22`, `unit_tests/risk.rules.test.ts:23`
- Impact: these tests still validate copied logic rather than the production implementation, so the original coverage-quality concern remains.
- Minimum actionable fix: import and exercise production modules directly, or refactor production code to be directly testable without logic duplication.

## 6. Security Review Summary
- Authentication entry points: **Partial Pass**. The previously reported insecure default deployment issue is fixed through required env secrets and dev/test-only admin seeding. Failed-login audit coverage remains unresolved. Evidence: `docker-compose.yml:37`, `docker-compose.yml:44`, `scripts/seed.ts:27`, `src/services/auth.service.ts:55`
- Route-level authorization: **Pass**. The prior organization-management authority issue is fixed by removing tenant API organization creation and keeping org operations scoped. Evidence: `src/routes/admin.routes.ts:28`
- Object-level authorization: **Pass**. The prior recycle-bin restore pin-limit issue is fixed. Evidence: `src/services/moderation.service.ts:254`
- Function-level authorization: **Pass** for the previously listed organization-management issue only. The service no longer exposes arbitrary org creation. Evidence: `src/services/admin.service.ts:27`
- Tenant / user isolation: **Pass** for the previously listed issues only. No regression observed in the fixed organization-management or restore-path logic. Evidence: `src/services/admin.service.ts:41`, `src/services/moderation.service.ts:263`
- Admin / internal / debug protection: **Pass** for the previously listed insecure-default issue only. Required Compose secrets remove the earlier predictable internal key startup path. Evidence: `docker-compose.yml:44`

## 7. Tests and Logging Review
- Unit tests: **Partial Pass**
- Rationale: the previously reported duplication issue remains unresolved.
- Evidence: `unit_tests/internal-auth.test.ts:13`, `unit_tests/log.redaction.test.ts:11`, `unit_tests/notification.retry.test.ts:22`, `unit_tests/risk.rules.test.ts:23`

- API / integration tests: **Cannot Confirm Statistically**
- Rationale: this review was limited to checking prior issue fixes and did not rerun or broadly reassess API test coverage beyond those listed issues.
- Evidence: `../.tmp/audit_report_2.md:157`

- Logging categories / observability: **Cannot Confirm Statistically**
- Rationale: no prior listed bug targeted logging category structure itself; only the duplicated redaction tests issue was rechecked.
- Evidence: `../.tmp/audit_report_2.md:141`

- Sensitive-data leakage risk in logs / responses: **Partial Pass**
- Rationale: the previous insecure default deployment path is fixed, but the duplicated redaction-test issue remains.
- Evidence: `README.md:52`, `docker-compose.yml:37`, `unit_tests/log.redaction.test.ts:11`

## 8. Test Coverage Assessment (Static Audit)

### 8.1 Test Overview
- The prior report’s coverage-quality issue was limited to duplicated unit-test logic in four files. Those files remain in the same duplicated-test pattern.
- Evidence: `unit_tests/internal-auth.test.ts:13`, `unit_tests/log.redaction.test.ts:11`, `unit_tests/notification.retry.test.ts:22`, `unit_tests/risk.rules.test.ts:23`

### 8.2 Coverage Mapping Table
| Previously Reported Issue | Current Evidence | Status | Gap |
|---|---|---|---|
| Insecure default deployment path | `docker-compose.yml:37`, `docker-compose.yml:44`, `scripts/seed.ts:27`, `README.md:52` | fixed | none |
| Organization-management authority | `src/routes/admin.routes.ts:28`, `src/services/admin.service.ts:27` | fixed | none |
| Restore-path pin-limit bypass | `src/services/moderation.service.ts:254` | fixed | none |
| Audit immutability / auditLogId | `prisma/schema.prisma:351`, `prisma/schema.prisma:353` | not fixed | schema/storage enforcement still absent |
| Failed login auditability | `src/services/auth.service.ts:55`, `src/services/auth.service.ts:73` | not fixed | failures still not in `AuditLog` |
| Carousel invalid time windows | `src/schemas/admin.schema.ts:42` | not fixed | no date-order refinement |
| Notification open success-on-noop | `src/controllers/notifications.controller.ts:26`, `src/repositories/notification.repository.ts:66` | not fixed | no update count / 404 handling |
| PITR/binlog delivery | `README.md:265`, `docker-compose.yml:10` | not fixed | documented only, not configured |
| Duplicated unit-test logic | `unit_tests/internal-auth.test.ts:13`, `unit_tests/log.redaction.test.ts:11`, `unit_tests/notification.retry.test.ts:22`, `unit_tests/risk.rules.test.ts:23` | not fixed | still not exercising production code directly |

### 8.3 Security Coverage Audit
- authentication: **Partial Pass**. Deployment-secret/default exposure issue is fixed, but failed-login audit coverage is still missing.
- route authorization: **Pass**. Organization API authority issue is fixed.
- object-level authorization: **Pass**. Restore-path pin-limit issue is fixed.
- tenant / data isolation: **Pass** for the previously listed org-management issue.
- admin / internal protection: **Pass** for the previously listed default-secret/internal-key issue.

### 8.4 Final Coverage Judgment
- **Partial Pass**
- Fixed prior issues: 1, 2, 3.
- Unfixed prior issues: 4, 5, 6, 7, 8, 9.

## 9. Final Notes
- This verification is strictly limited to the issues listed in `../.tmp/audit_report_2.md`.
- No new issues were introduced in this report.
- Output file created at `./.tmp/audit-bugfix-report-2.md`.
