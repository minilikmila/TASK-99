# CivicForum Operations Platform API Specification

## 1. Scope

This specification defines backend APIs for a multi-tenant, offline-first civic forum service.
All APIs are organization-scoped and run locally with no external integrations.

Base path: `/api/v1`

## 2. Conventions

- **Content type**: `application/json`
- **Auth**: session cookie or signed token (`Authorization: Bearer <token>`)
- **Tenant scope**: every request resolves `organizationId` from authenticated context
- **Correlation ID**: request/response header `X-Correlation-Id`
- **Pagination**: `page` (1-based), `pageSize` (default 20, max 100)
- **Time format**: ISO 8601 UTC

### 2.1 Roles

- `ADMINISTRATOR`: full org control
- `MODERATOR`: content and user moderation
- `ANALYST`: read-only dashboards and reports
- `USER`: forum participation

### 2.2 Standard Error Shape

```json
{
  "error": {
    "code": "THREAD_LOCKED",
    "message": "Thread is locked and cannot accept new replies.",
    "details": {}
  },
  "correlationId": "a3d10f7f-b2f8-4a7c-9018-f4e2a9f7e133"
}
```

Common codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `RATE_LIMITED`, `CONFLICT`.

## 3. Authentication and Identity

### 3.1 Login

`POST /auth/login`

Request:

```json
{
  "organizationSlug": "city-club",
  "username": "alice",
  "password": "minimum-12-characters"
}
```

Rules:
- Password minimum length: 12
- Lockout after 5 failed attempts in 15 minutes
- Ban blocks login

Response:

```json
{
  "user": {
    "id": "usr_123",
    "organizationId": "org_1",
    "role": "MODERATOR",
    "isBanned": false,
    "muteUntil": null
  },
  "token": "signed-local-token"
}
```

### 3.2 Logout

`POST /auth/logout`

Invalidates session/token locally.

### 3.3 Current User

`GET /auth/me`

Returns user profile, role, and moderation status (`isBanned`, `muteUntil`).

## 4. Forum Taxonomy APIs

### 4.1 Sections

- `GET /sections`
- `POST /sections` (admin/moderator)
- `PATCH /sections/{sectionId}` (admin/moderator)

### 4.2 Subsections

- `GET /sections/{sectionId}/subsections`
- `POST /sections/{sectionId}/subsections`

### 4.3 Tags (Flat Taxonomy)

- `GET /tags`
- `POST /tags`
- `PATCH /tags/{tagId}`
- `DELETE /tags/{tagId}`

Constraints:
- Unique `slug` per organization
- Flat model (no hierarchy for v1)

## 5. Threads APIs

### 5.1 Create Thread

`POST /threads`

Request:

```json
{
  "sectionId": "sec_1",
  "subsectionId": "sub_1",
  "title": "Road safety proposal",
  "body": "Initial post content",
  "tagIds": ["tag_1", "tag_3"],
  "isFeatured": false
}
```

Response: `201 Created` with thread resource.

### 5.2 Query Threads

`GET /threads?sectionId=sec_1&state=active&tag=transport&page=1&pageSize=20`

Supports filters:
- `sectionId`, `subsectionId`
- `state` (`active`, `locked`, `archived`)
- `isPinned`, `isFeatured`
- `tag`

### 5.3 Get Thread

`GET /threads/{threadId}`

### 5.4 Update Thread

`PATCH /threads/{threadId}`

Rules:
- Archived thread cannot be edited
- If thread locked, content edits allowed only for moderator/admin

### 5.5 Thread State Transitions

`POST /threads/{threadId}/state`

Request:

```json
{
  "toState": "locked"
}
```

Allowed transitions:
- `active -> locked`
- `locked -> archived`
- `active -> archived`

Disallowed:
- Any transition from `archived` to non-archived

### 5.6 Pin/Unpin

- `POST /threads/{threadId}/pin`
- `POST /threads/{threadId}/unpin`

Rule: maximum 3 pinned threads per section. Pin attempt beyond limit returns `CONFLICT`.

## 6. Replies APIs

### 6.1 Create Reply

`POST /threads/{threadId}/replies`

Request:

```json
{
  "parentReplyId": null,
  "body": "I support this proposal."
}
```

Rules:
- Thread locked: reject new replies
- Thread archived: reject new replies
- Nested depth max: 3 (root depth is 1)
- Muted user cannot post/reply until `muteUntil`

### 6.2 List Replies

`GET /threads/{threadId}/replies`

Returns tree-ready structure with `depth`.

### 6.3 Update/Delete Reply

- `PATCH /replies/{replyId}`
- `DELETE /replies/{replyId}` (soft delete to recycle bin)

Rule: archived thread blocks reply edits.

## 7. Moderation APIs

### 7.1 Ban/Unban

- `POST /moderation/users/{userId}/ban`
- `POST /moderation/users/{userId}/unban`

Ban effect: cannot login.

### 7.2 Mute/Unmute

- `POST /moderation/users/{userId}/mute`
- `POST /moderation/users/{userId}/unmute`

Mute request:

```json
{
  "durationHours": 72,
  "reason": "Repeated spam"
}
```

Rules:
- 24h minimum, 30d maximum
- Mute effect: cannot create thread/reply

### 7.3 Bulk Content Actions

`POST /moderation/content/bulk`

Request:

```json
{
  "action": "archive_threads",
  "threadIds": ["thr_1", "thr_2"]
}
```

Rules:
- Max 100 items per request
- No transactional rollback for full batch
- Each item audit-logged individually

### 7.4 Recycle Bin

- `GET /moderation/recycle-bin`
- `POST /moderation/recycle-bin/{itemId}/restore`
- `DELETE /moderation/recycle-bin/{itemId}/purge`

Rules:
- Retention: 30 days
- Restore fails on dependency conflict (missing section/tag/etc.)

## 8. Admin Configuration APIs

### 8.1 Organizations

- `GET /admin/organizations`
- `POST /admin/organizations`
- `PATCH /admin/organizations/{organizationId}`

### 8.2 Announcements

- `GET /admin/announcements`
- `POST /admin/announcements`
- `PATCH /admin/announcements/{announcementId}`
- `DELETE /admin/announcements/{announcementId}`

Announcement fields: `title`, `body`, `order`, `startAt`, `endAt`, `isPublished`.

### 8.3 Carousel Items

- `GET /admin/carousel-items`
- `POST /admin/carousel-items`
- `PATCH /admin/carousel-items/{itemId}`
- `DELETE /admin/carousel-items/{itemId}`

Ordered items with active-time window.

### 8.4 Venue Resources and Booking

- `GET /admin/venues`
- `POST /admin/venues`
- `POST /admin/venues/{venueId}/bookings`
- `PATCH /admin/venue-bookings/{bookingId}`

Conflict validation: reject when `(startAt < existingEndAt) AND (endAt > existingStartAt)` within same room.

## 9. Notifications APIs (Local In-App Only)

### 9.1 Subscriptions

- `GET /notifications/subscriptions`
- `PUT /notifications/subscriptions`

Security notices default to opt-in and cannot be fully disabled.

### 9.2 Notification Inbox

- `GET /notifications`
- `POST /notifications/{notificationId}/open`

Tracks `deliveredAt`, `openedAt`.

### 9.3 Delivery Jobs (Internal/Privileged)

- `POST /internal/notifications/dispatch-due`
- `POST /internal/notifications/retry-failed`

Retry policy:
- Up to 3 retries
- Exponential backoff (1m, 5m, 30m baseline)
- Retry window within 24 hours

## 10. Audit, Analytics, and Risk APIs

### 10.1 Audit Logs

`GET /audit/logs?actorId=usr_1&eventType=permission_change&page=1&pageSize=50`

Includes login attempts, role updates, moderation, and config changes.
Audit records are append-only and immutable.

### 10.2 Funnel Dashboard

`GET /analytics/funnel?from=2026-04-01T00:00:00Z&to=2026-04-30T23:59:59Z`

Returns aggregated forum funnel:
- `view`
- `registration`
- `post`
- `engagement`

### 10.3 Abnormal Behavior Flags

`GET /risk/flags?status=open`

Rule-based flags:
- User deletes >= 10 threads within 1h
- User cancels/undos >= 20 within 1h
- Thread receives >= 5 reports within 30m

System creates review flags; no automatic punitive action.

## 11. Non-Functional API Requirements

- **Rate limits per user**:
  - Writes: 120/min
  - Reads: 600/min
- **Performance target**:
  - p95 reads under 300 ms for common queries at 500 concurrent users
- **Backups**:
  - Nightly local backups
  - 14-day retention
  - PITR via binlog when available
- **Offline mode**:
  - No SMS/email/WeChat
  - No external network dependencies
