/**
 * Unit tests for risk detection rule thresholds and window logic.
 * Validates pure business logic without database access.
 */

/// <reference types="jest" />
export {};
import { describe, expect, test } from "@jest/globals";

// ─── Shared helpers ───────────────────────────────────────────────────────────

interface AuditEventLike {
  actorId: string;
  eventType: string;
  createdAt: Date;
}

const now = new Date("2026-04-01T12:00:00Z");
const minsAgo = (m: number): Date => new Date(now.getTime() - m * 60_000);

// ─── Rule: HIGH_THREAD_DELETIONS (≥10 thread deletions in 1 hour) ─────────────

function countThreadDeletions(
  events: AuditEventLike[],
  actorId: string,
  since: Date
): number {
  return events.filter(
    (e) =>
      e.actorId === actorId &&
      e.eventType === "thread.deleted" &&
      e.createdAt >= since
  ).length;
}

function shouldFlagHighThreadDeletions(
  events: AuditEventLike[],
  actorId: string,
  since: Date,
  threshold = 10
): boolean {
  return countThreadDeletions(events, actorId, since) >= threshold;
}

describe("HIGH_THREAD_DELETIONS rule", () => {
  const since = minsAgo(60);

  test("9 recent deletions → no flag", () => {
    const events = Array.from({ length: 9 }, () => ({
      actorId: "u1",
      eventType: "thread.deleted",
      createdAt: minsAgo(5),
    }));
    expect(shouldFlagHighThreadDeletions(events, "u1", since)).toBe(false);
  });

  test("10 recent deletions → flag", () => {
    const events = Array.from({ length: 10 }, () => ({
      actorId: "u1",
      eventType: "thread.deleted",
      createdAt: minsAgo(5),
    }));
    expect(shouldFlagHighThreadDeletions(events, "u1", since)).toBe(true);
  });

  test("11 recent deletions → still flagged", () => {
    const events = Array.from({ length: 11 }, () => ({
      actorId: "u1",
      eventType: "thread.deleted",
      createdAt: minsAgo(5),
    }));
    expect(shouldFlagHighThreadDeletions(events, "u1", since)).toBe(true);
  });

  test("10 deletions outside window → no flag", () => {
    const events = Array.from({ length: 10 }, () => ({
      actorId: "u1",
      eventType: "thread.deleted",
      createdAt: minsAgo(90), // outside 1-hour window
    }));
    expect(shouldFlagHighThreadDeletions(events, "u1", since)).toBe(false);
  });

  test("different actor's deletions don't count", () => {
    const events = Array.from({ length: 10 }, () => ({
      actorId: "u2",
      eventType: "thread.deleted",
      createdAt: minsAgo(5),
    }));
    expect(shouldFlagHighThreadDeletions(events, "u1", since)).toBe(false);
  });

  test("mix of old and recent: only 10 recent → flag", () => {
    const events = [
      ...Array.from({ length: 5 }, () => ({ actorId: "u1", eventType: "thread.deleted", createdAt: minsAgo(90) })),
      ...Array.from({ length: 10 }, () => ({ actorId: "u1", eventType: "thread.deleted", createdAt: minsAgo(10) })),
    ];
    expect(shouldFlagHighThreadDeletions(events, "u1", since)).toBe(true);
  });
});

// ─── Rule: HIGH_CANCELLATIONS (≥20 reply deletions + restores in 1 hour) ─────

const CANCELLATION_EVENTS = new Set(["reply.deleted", "recycle_bin.restored"]);

function countCancellations(
  events: AuditEventLike[],
  actorId: string,
  since: Date
): number {
  return events.filter(
    (e) =>
      e.actorId === actorId &&
      CANCELLATION_EVENTS.has(e.eventType) &&
      e.createdAt >= since
  ).length;
}

function shouldFlagHighCancellations(
  events: AuditEventLike[],
  actorId: string,
  since: Date,
  threshold = 20
): boolean {
  return countCancellations(events, actorId, since) >= threshold;
}

describe("HIGH_CANCELLATIONS rule", () => {
  const since = minsAgo(60);

  test("19 cancellations → no flag", () => {
    const events = Array.from({ length: 19 }, () => ({
      actorId: "u1",
      eventType: "reply.deleted",
      createdAt: minsAgo(5),
    }));
    expect(shouldFlagHighCancellations(events, "u1", since)).toBe(false);
  });

  test("20 reply.deleted → flag", () => {
    const events = Array.from({ length: 20 }, () => ({
      actorId: "u1",
      eventType: "reply.deleted",
      createdAt: minsAgo(5),
    }));
    expect(shouldFlagHighCancellations(events, "u1", since)).toBe(true);
  });

  test("10 reply.deleted + 10 recycle_bin.restored = 20 → flag", () => {
    const events = [
      ...Array.from({ length: 10 }, () => ({ actorId: "u1", eventType: "reply.deleted", createdAt: minsAgo(5) })),
      ...Array.from({ length: 10 }, () => ({ actorId: "u1", eventType: "recycle_bin.restored", createdAt: minsAgo(5) })),
    ];
    expect(shouldFlagHighCancellations(events, "u1", since)).toBe(true);
  });

  test("20 cancellations outside window → no flag", () => {
    const events = Array.from({ length: 20 }, () => ({
      actorId: "u1",
      eventType: "reply.deleted",
      createdAt: minsAgo(120),
    }));
    expect(shouldFlagHighCancellations(events, "u1", since)).toBe(false);
  });

  test("thread.deleted events don't count toward HIGH_CANCELLATIONS", () => {
    const events = Array.from({ length: 20 }, () => ({
      actorId: "u1",
      eventType: "thread.deleted", // covered by separate HIGH_THREAD_DELETIONS rule
      createdAt: minsAgo(5),
    }));
    expect(shouldFlagHighCancellations(events, "u1", since)).toBe(false);
  });
});

// ─── Rule: HIGH_REPORT_VOLUME (≥5 reports on same thread in 30 minutes) ──────

interface ReportEventLike {
  resourceId: string;
  eventType: string;
  createdAt: Date;
}

function countReportsForThread(
  events: ReportEventLike[],
  threadId: string,
  since: Date
): number {
  return events.filter(
    (e) =>
      e.resourceId === threadId &&
      e.eventType === "thread.reported" &&
      e.createdAt >= since
  ).length;
}

function shouldFlagHighReportVolume(
  events: ReportEventLike[],
  threadId: string,
  since: Date,
  threshold = 5
): boolean {
  return countReportsForThread(events, threadId, since) >= threshold;
}

describe("HIGH_REPORT_VOLUME rule", () => {
  const since = minsAgo(30);

  test("4 reports in 30 min → no flag", () => {
    const events = Array.from({ length: 4 }, () => ({
      resourceId: "t1",
      eventType: "thread.reported",
      createdAt: minsAgo(5),
    }));
    expect(shouldFlagHighReportVolume(events, "t1", since)).toBe(false);
  });

  test("5 reports in 30 min → flag", () => {
    const events = Array.from({ length: 5 }, () => ({
      resourceId: "t1",
      eventType: "thread.reported",
      createdAt: minsAgo(5),
    }));
    expect(shouldFlagHighReportVolume(events, "t1", since)).toBe(true);
  });

  test("5 reports older than 30 min → no flag", () => {
    const events = Array.from({ length: 5 }, () => ({
      resourceId: "t1",
      eventType: "thread.reported",
      createdAt: minsAgo(45),
    }));
    expect(shouldFlagHighReportVolume(events, "t1", since)).toBe(false);
  });

  test("reports on different thread don't count", () => {
    const events = Array.from({ length: 5 }, () => ({
      resourceId: "t2",
      eventType: "thread.reported",
      createdAt: minsAgo(5),
    }));
    expect(shouldFlagHighReportVolume(events, "t1", since)).toBe(false);
  });

  test("mix of threads: only t1 reaches threshold", () => {
    const events = [
      ...Array.from({ length: 5 }, () => ({ resourceId: "t1", eventType: "thread.reported", createdAt: minsAgo(5) })),
      ...Array.from({ length: 3 }, () => ({ resourceId: "t2", eventType: "thread.reported", createdAt: minsAgo(5) })),
    ];
    expect(shouldFlagHighReportVolume(events, "t1", since)).toBe(true);
    expect(shouldFlagHighReportVolume(events, "t2", since)).toBe(false);
  });
});
