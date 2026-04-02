Business Logic Questions Log
1. Multi-tenant data isolation enforcement

Question: Prompt says all entities must be scoped by organizationId, but does not define cross-tenant access rules for shared roles like Analysts.
My Understanding: Every query must strictly filter by organizationId; no cross-tenant reads unless explicitly allowed.
Solution: Enforce middleware-level tenant scoping and add composite indexes (organizationId, id) across all tables.

2. Nested replies depth enforcement

Question: Replies support nesting up to 3 levels, but no rule for handling deeper attempts.
My Understanding: Level >3 should be rejected, not flattened.
Solution: Add depth field and validation logic blocking inserts when depth >= 3.

3. Thread state transition rules

Question: Prompt defines rules (locked, archived, pinned), but not full transition lifecycle.
My Understanding: Some transitions should be irreversible (e.g., archived).
Solution: Implement a strict state machine with allowed transitions:

active → locked → archived
prevent archived → active rollback
4. Pinned threads limit enforcement

Question: "Pinned limited to 3 per section" — what happens when adding a 4th?
My Understanding: Either reject or auto-unpin oldest.
Solution: Reject operation with error unless explicitly replacing an existing pinned thread.

5. Tag taxonomy hierarchy

Question: Are tags flat or hierarchical (parent-child)?
My Understanding: Flat structure unless explicitly needed.
Solution: Implement flat tags with optional future parentId extension.

6. Ban vs mute behavior difference

Question: Prompt includes both ban and mute but doesn't define exact behavior.
My Understanding:

Ban = no login
Mute = cannot post/reply
Solution: Add flags:
isBanned
muteUntil
7. Bulk moderation actions scope

Question: Bulk actions—what's the limit and rollback behavior?
My Understanding: No rollback; actions are final but logged.
Solution: Limit batch size (e.g., 100 items) and log each item in audit logs.

8. Recycle bin restore conflicts

Question: What happens if restoring content conflicts with current state (e.g., tag deleted)?
My Understanding: Restore should fail if dependencies missing.
Solution: Validate dependencies before restore; otherwise block operation.

9. Notification retry mechanism

Question: Retry policy defined (3 times, exponential), but no failure definition.
My Understanding: Failure = not marked delivered.
Solution: Add status field and retry scheduler with exponential delay (e.g., 1m → 5m → 30m).

10. Offline-first conflict resolution

Question: How to handle conflicting updates when clients sync?
My Understanding: Last-write-wins with timestamp priority.
Solution: Add updatedAt and reject stale updates unless forced.

11. Audit log immutability enforcement

Question: Prompt says append-only, but how strictly enforced?
My Understanding: No updates or deletes allowed at DB level.
Solution: Use separate table with no update/delete permissions and enforce via DB constraints.

12. Abnormal behavior thresholds action

Question: Detection rules exist, but no action defined after flagging.
My Understanding: Only flagging, not auto-punishment.
Solution: Insert into flags table and notify moderators.

13. Metrics event tracking source

Question: Metrics (view → engagement) require event tracking, but events are not defined.
My Understanding: Must explicitly log events like thread_view, reply_created.
Solution: Create event_logs table and derive metrics via aggregation queries.

14. Venue booking conflict rules scope

Question: Booking conflicts defined per room, but no time granularity.
My Understanding: Conflict = overlapping time ranges.
Solution: Validate using (start < existing_end AND end > existing_start) logic.

15. Rate limiting storage mechanism

Question: Rate limits defined, but storage approach unclear (no Redis allowed).
My Understanding: Must be local (in-memory or DB).
Solution: Use in-memory sliding window per instance; accept limitation of non-distributed consistency.