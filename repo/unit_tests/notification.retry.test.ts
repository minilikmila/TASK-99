/**
 * Unit tests for notification retry and subscription logic.
 * Tests pure business rules without database access.
 */

export {};

// ─── Retry backoff schedule ───────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAYS_MINUTES = [1, 5, 30];
const RETRY_WINDOW_HOURS = 24;

interface NotificationLike {
  id: string;
  status: "PENDING" | "DELIVERED" | "FAILED" | "OPENED";
  retryCount: number;
  createdAt: Date;
  nextRetryAt: Date | null;
}

function getNextRetryDelay(retryCount: number): number {
  return RETRY_DELAYS_MINUTES[retryCount] ?? RETRY_DELAYS_MINUTES.at(-1) ?? 30;
}

function shouldRetry(
  n: NotificationLike,
  now: Date,
  windowHours: number
): boolean {
  if (n.status !== "FAILED") return false;
  if (n.retryCount >= MAX_RETRIES) return false;
  const windowStart = new Date(now.getTime() - windowHours * 3_600_000);
  if (n.createdAt < windowStart) return false;
  if (n.nextRetryAt && n.nextRetryAt > now) return false;
  return true;
}

const now = new Date("2026-04-01T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000);

describe("Notification retry eligibility", () => {
  test("FAILED with 0 retries and no nextRetryAt → eligible", () => {
    const n: NotificationLike = {
      id: "n1",
      status: "FAILED",
      retryCount: 0,
      createdAt: hoursAgo(1),
      nextRetryAt: null,
    };
    expect(shouldRetry(n, now, RETRY_WINDOW_HOURS)).toBe(true);
  });

  test("FAILED with retryCount at max → not eligible", () => {
    const n: NotificationLike = {
      id: "n2",
      status: "FAILED",
      retryCount: MAX_RETRIES,
      createdAt: hoursAgo(1),
      nextRetryAt: null,
    };
    expect(shouldRetry(n, now, RETRY_WINDOW_HOURS)).toBe(false);
  });

  test("FAILED but outside 24-hour window → not eligible", () => {
    const n: NotificationLike = {
      id: "n3",
      status: "FAILED",
      retryCount: 1,
      createdAt: hoursAgo(25), // older than 24h window
      nextRetryAt: null,
    };
    expect(shouldRetry(n, now, RETRY_WINDOW_HOURS)).toBe(false);
  });

  test("FAILED but nextRetryAt is in the future → not yet eligible", () => {
    const n: NotificationLike = {
      id: "n4",
      status: "FAILED",
      retryCount: 1,
      createdAt: hoursAgo(1),
      nextRetryAt: new Date(now.getTime() + 5 * 60_000), // 5 min in future
    };
    expect(shouldRetry(n, now, RETRY_WINDOW_HOURS)).toBe(false);
  });

  test("FAILED with nextRetryAt in the past → eligible", () => {
    const n: NotificationLike = {
      id: "n5",
      status: "FAILED",
      retryCount: 1,
      createdAt: hoursAgo(2),
      nextRetryAt: minsAgo(1), // past
    };
    expect(shouldRetry(n, now, RETRY_WINDOW_HOURS)).toBe(true);
  });

  test("PENDING (not failed) → not eligible for retry", () => {
    const n: NotificationLike = {
      id: "n6",
      status: "PENDING",
      retryCount: 0,
      createdAt: hoursAgo(1),
      nextRetryAt: null,
    };
    expect(shouldRetry(n, now, RETRY_WINDOW_HOURS)).toBe(false);
  });

  test("DELIVERED → not eligible for retry", () => {
    const n: NotificationLike = {
      id: "n7",
      status: "DELIVERED",
      retryCount: 2,
      createdAt: hoursAgo(1),
      nextRetryAt: null,
    };
    expect(shouldRetry(n, now, RETRY_WINDOW_HOURS)).toBe(false);
  });
});

describe("Exponential backoff delay schedule", () => {
  test("first retry (retryCount=0 → next attempt 1) uses delay[0] = 1 min", () => {
    expect(getNextRetryDelay(0)).toBe(1);
  });

  test("second retry uses delay[1] = 5 min", () => {
    expect(getNextRetryDelay(1)).toBe(5);
  });

  test("third retry uses delay[2] = 30 min", () => {
    expect(getNextRetryDelay(2)).toBe(30);
  });

  test("beyond defined delays falls back to last delay (30 min)", () => {
    expect(getNextRetryDelay(99)).toBe(30);
  });
});

// ─── Subscription opt-out enforcement ────────────────────────────────────────

type Category = "reply" | "announcement" | "security" | string;

interface SubscriptionLike {
  category: Category;
  isOptIn: boolean;
}

function isDeliveryAllowed(
  category: Category,
  subscriptions: SubscriptionLike[]
): boolean {
  // Security notices bypass opt-out
  if (category === "security") return true;

  const sub = subscriptions.find((s) => s.category === category);
  // No record means default opt-in
  if (!sub) return true;
  return sub.isOptIn;
}

describe("Subscription delivery gating", () => {
  test("no subscription record → default opt-in, notification allowed", () => {
    expect(isDeliveryAllowed("reply", [])).toBe(true);
  });

  test("explicit opt-in → allowed", () => {
    expect(isDeliveryAllowed("reply", [{ category: "reply", isOptIn: true }])).toBe(true);
  });

  test("explicit opt-out → blocked", () => {
    expect(isDeliveryAllowed("reply", [{ category: "reply", isOptIn: false }])).toBe(false);
  });

  test("opt-out for 'announcement' does not affect 'reply'", () => {
    expect(
      isDeliveryAllowed("reply", [{ category: "announcement", isOptIn: false }])
    ).toBe(true);
  });

  test("security category ignores opt-out record → always allowed", () => {
    expect(
      isDeliveryAllowed("security", [{ category: "security", isOptIn: false }])
    ).toBe(true);
  });

  test("security with no record → allowed", () => {
    expect(isDeliveryAllowed("security", [])).toBe(true);
  });
});
