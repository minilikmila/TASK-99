/**
 * Unit tests for authentication lockout logic.
 * Tests the lockout window and attempt-counting rules.
 */

export {};

const LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface LoginAttempt {
  success: boolean;
  createdAt: Date;
}

function countRecentFailures(
  attempts: LoginAttempt[],
  windowMs: number,
  now: Date
): number {
  const cutoff = new Date(now.getTime() - windowMs);
  return attempts.filter(
    (a) => !a.success && a.createdAt >= cutoff
  ).length;
}

function isLockedOut(
  attempts: LoginAttempt[],
  windowMs: number,
  maxAttempts: number,
  now: Date
): boolean {
  return countRecentFailures(attempts, windowMs, now) >= maxAttempts;
}

const now = new Date("2026-04-01T12:00:00Z");
const recent = (minutesAgo: number): Date =>
  new Date(now.getTime() - minutesAgo * 60_000);

describe("Login lockout — failure counting", () => {
  test("0 failures → no lockout", () => {
    expect(isLockedOut([], LOCKOUT_WINDOW_MS, LOCKOUT_ATTEMPTS, now)).toBe(false);
  });

  test("4 recent failures → no lockout", () => {
    const attempts: LoginAttempt[] = Array.from({ length: 4 }, () => ({
      success: false,
      createdAt: recent(5),
    }));
    expect(isLockedOut(attempts, LOCKOUT_WINDOW_MS, LOCKOUT_ATTEMPTS, now)).toBe(false);
  });

  test("5 recent failures → locked out", () => {
    const attempts: LoginAttempt[] = Array.from({ length: 5 }, () => ({
      success: false,
      createdAt: recent(5),
    }));
    expect(isLockedOut(attempts, LOCKOUT_WINDOW_MS, LOCKOUT_ATTEMPTS, now)).toBe(true);
  });

  test("6 recent failures → still locked out", () => {
    const attempts: LoginAttempt[] = Array.from({ length: 6 }, () => ({
      success: false,
      createdAt: recent(1),
    }));
    expect(isLockedOut(attempts, LOCKOUT_WINDOW_MS, LOCKOUT_ATTEMPTS, now)).toBe(true);
  });

  test("5 old failures (outside window) → no lockout", () => {
    const attempts: LoginAttempt[] = Array.from({ length: 5 }, () => ({
      success: false,
      createdAt: recent(20), // 20 min ago, outside 15-min window
    }));
    expect(isLockedOut(attempts, LOCKOUT_WINDOW_MS, LOCKOUT_ATTEMPTS, now)).toBe(false);
  });

  test("5 failures, 1 success in window → no lockout (successes don't count)", () => {
    const attempts: LoginAttempt[] = [
      ...Array.from({ length: 4 }, () => ({ success: false, createdAt: recent(5) })),
      { success: true, createdAt: recent(3) },
    ];
    expect(isLockedOut(attempts, LOCKOUT_WINDOW_MS, LOCKOUT_ATTEMPTS, now)).toBe(false);
  });

  test("mix of old and recent: only 5 recent failures → locked", () => {
    const attempts: LoginAttempt[] = [
      // 3 old failures, outside window
      ...Array.from({ length: 3 }, () => ({ success: false, createdAt: recent(20) })),
      // 5 recent failures
      ...Array.from({ length: 5 }, () => ({ success: false, createdAt: recent(10) })),
    ];
    expect(isLockedOut(attempts, LOCKOUT_WINDOW_MS, LOCKOUT_ATTEMPTS, now)).toBe(true);
  });
});
