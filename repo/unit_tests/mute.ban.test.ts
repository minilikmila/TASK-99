/**
 * Unit tests for mute and ban business logic.
 * Tests pure state-checking functions with no database access.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserLike {
  isBanned: boolean;
  muteUntil: Date | null;
}

// ─── Pure helpers mirroring the service logic ─────────────────────────────────

function isBanned(user: UserLike): boolean {
  return user.isBanned;
}

function isMuted(user: UserLike, now: Date): boolean {
  return user.muteUntil !== null && user.muteUntil > now;
}

function canPost(user: UserLike, now: Date): { allowed: boolean; reason?: string } {
  if (isBanned(user)) return { allowed: false, reason: "USER_BANNED" };
  if (isMuted(user, now)) return { allowed: false, reason: "USER_MUTED" };
  return { allowed: true };
}

function validateMuteDuration(
  hours: number,
  minHours = 24,
  maxHours = 720
): string | null {
  if (!Number.isInteger(hours)) return "durationHours must be an integer";
  if (hours < minHours) return `Minimum mute duration is ${minHours} hours`;
  if (hours > maxHours) return `Maximum mute duration is ${maxHours} hours`;
  return null;
}

const now = new Date("2026-04-01T12:00:00Z");
const hoursFromNow = (h: number) => new Date(now.getTime() + h * 3_600_000);
const hoursAgo     = (h: number) => new Date(now.getTime() - h * 3_600_000);

// ─── isBanned ────────────────────────────────────────────────────────────────

describe("isBanned", () => {
  test("returns true when isBanned=true", () => {
    expect(isBanned({ isBanned: true, muteUntil: null })).toBe(true);
  });

  test("returns false when isBanned=false", () => {
    expect(isBanned({ isBanned: false, muteUntil: null })).toBe(false);
  });

  test("mute status does not affect ban result", () => {
    expect(isBanned({ isBanned: false, muteUntil: hoursFromNow(24) })).toBe(false);
    expect(isBanned({ isBanned: true,  muteUntil: null })).toBe(true);
  });
});

// ─── isMuted ─────────────────────────────────────────────────────────────────

describe("isMuted", () => {
  test("muteUntil is null → not muted", () => {
    expect(isMuted({ isBanned: false, muteUntil: null }, now)).toBe(false);
  });

  test("muteUntil in the future → muted", () => {
    expect(isMuted({ isBanned: false, muteUntil: hoursFromNow(1) }, now)).toBe(true);
  });

  test("muteUntil is exactly now → not muted (boundary: > not >=)", () => {
    expect(isMuted({ isBanned: false, muteUntil: now }, now)).toBe(false);
  });

  test("muteUntil is in the past → not muted (expired)", () => {
    expect(isMuted({ isBanned: false, muteUntil: hoursAgo(1) }, now)).toBe(false);
  });

  test("mute 24 hours from now is active", () => {
    expect(isMuted({ isBanned: false, muteUntil: hoursFromNow(24) }, now)).toBe(true);
  });

  test("mute 30 days from now is active", () => {
    expect(isMuted({ isBanned: false, muteUntil: hoursFromNow(720) }, now)).toBe(true);
  });
});

// ─── canPost ──────────────────────────────────────────────────────────────────

describe("canPost", () => {
  test("active, non-muted user can post", () => {
    const result = canPost({ isBanned: false, muteUntil: null }, now);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  test("banned user cannot post", () => {
    const result = canPost({ isBanned: true, muteUntil: null }, now);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("USER_BANNED");
  });

  test("muted user cannot post", () => {
    const result = canPost({ isBanned: false, muteUntil: hoursFromNow(24) }, now);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("USER_MUTED");
  });

  test("banned AND muted → ban takes precedence", () => {
    const result = canPost({ isBanned: true, muteUntil: hoursFromNow(24) }, now);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("USER_BANNED");
  });

  test("expired mute allows posting", () => {
    const result = canPost({ isBanned: false, muteUntil: hoursAgo(1) }, now);
    expect(result.allowed).toBe(true);
  });
});

// ─── validateMuteDuration ────────────────────────────────────────────────────

describe("validateMuteDuration", () => {
  test("24 hours — minimum allowed → valid", () => {
    expect(validateMuteDuration(24)).toBeNull();
  });

  test("720 hours (30 days) — maximum allowed → valid", () => {
    expect(validateMuteDuration(720)).toBeNull();
  });

  test("48 hours — mid-range → valid", () => {
    expect(validateMuteDuration(48)).toBeNull();
  });

  test("23 hours — below minimum → error", () => {
    expect(validateMuteDuration(23)).toMatch(/Minimum mute duration/);
  });

  test("0 hours — zero → error", () => {
    expect(validateMuteDuration(0)).toMatch(/Minimum mute duration/);
  });

  test("721 hours — above maximum → error", () => {
    expect(validateMuteDuration(721)).toMatch(/Maximum mute duration/);
  });

  test("1000 hours — far above maximum → error", () => {
    expect(validateMuteDuration(1000)).toMatch(/Maximum mute duration/);
  });

  test("non-integer (24.5) → error", () => {
    expect(validateMuteDuration(24.5)).toMatch(/integer/);
  });
});

// ─── Ban state transitions ────────────────────────────────────────────────────

describe("Ban state correctness", () => {
  test("setting isBanned=true is idempotent (banning again is harmless)", () => {
    const user: UserLike = { isBanned: true, muteUntil: null };
    const afterBan = { ...user, isBanned: true };
    expect(isBanned(afterBan)).toBe(true);
  });

  test("setting isBanned=false unblocks the user", () => {
    const banned: UserLike = { isBanned: true, muteUntil: null };
    const unbanned = { ...banned, isBanned: false };
    expect(isBanned(unbanned)).toBe(false);
    expect(canPost(unbanned, now).allowed).toBe(true);
  });

  test("unmuting sets muteUntil to null", () => {
    const muted: UserLike = { isBanned: false, muteUntil: hoursFromNow(24) };
    const unmuted = { ...muted, muteUntil: null };
    expect(isMuted(unmuted, now)).toBe(false);
    expect(canPost(unmuted, now).allowed).toBe(true);
  });
});
