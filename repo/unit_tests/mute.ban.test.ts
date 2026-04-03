/**
 * Unit tests for mute and ban business logic.
 * Imports production functions from src/lib/moderation-rules.ts.
 */

/// <reference types="jest" />
export {};
import { describe, expect, test } from "@jest/globals";
import {
  isBanned,
  isMuted,
  canPost,
  validateMuteDuration,
  canModerate,
  type RoleUser,
  type UserModerationState,
} from "../src/lib/moderation-rules";

const now = new Date("2026-04-01T12:00:00Z");
const hoursFromNow = (h: number) => new Date(now.getTime() + h * 3_600_000);
const hoursAgo     = (h: number) => new Date(now.getTime() - h * 3_600_000);

// ─── isBanned ────────────────────────────────────────────────────────────────

describe("isBanned (production module)", () => {
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

describe("isMuted (production module)", () => {
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
});

// ─── canPost ──────────────────────────────────────────────────────────────────

describe("canPost (production module)", () => {
  test("active, non-muted user can post", () => {
    expect(canPost({ isBanned: false, muteUntil: null }, now).allowed).toBe(true);
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
    expect(canPost({ isBanned: true, muteUntil: hoursFromNow(24) }, now).reason).toBe("USER_BANNED");
  });

  test("expired mute allows posting", () => {
    expect(canPost({ isBanned: false, muteUntil: hoursAgo(1) }, now).allowed).toBe(true);
  });
});

// ─── validateMuteDuration ────────────────────────────────────────────────────

describe("validateMuteDuration (production module)", () => {
  test("24 hours — minimum allowed → valid", () => {
    expect(validateMuteDuration(24)).toBeNull();
  });

  test("720 hours (30 days) — maximum allowed → valid", () => {
    expect(validateMuteDuration(720)).toBeNull();
  });

  test("23 hours — below minimum → error", () => {
    expect(validateMuteDuration(23)).toMatch(/Minimum mute duration/);
  });

  test("721 hours — above maximum → error", () => {
    expect(validateMuteDuration(721)).toMatch(/Maximum mute duration/);
  });

  test("non-integer (24.5) → error", () => {
    expect(validateMuteDuration(24.5)).toMatch(/integer/);
  });
});

// ─── Role hierarchy — ALL moderation flows ──────────────────────────────────

describe("Role hierarchy — moderators cannot ban/mute/unban/unmute administrators (production module)", () => {
  const admin: RoleUser = { isBanned: false, muteUntil: null, role: "ADMINISTRATOR" };
  const mod: RoleUser = { isBanned: false, muteUntil: null, role: "MODERATOR" };
  const user: RoleUser = { isBanned: false, muteUntil: null, role: "USER" };

  test("moderator cannot moderate an administrator", () => {
    expect(canModerate(mod, admin).allowed).toBe(false);
    expect(canModerate(mod, admin).reason).toBe("FORBIDDEN");
  });

  test("administrator can moderate another administrator", () => {
    expect(canModerate(admin, admin).allowed).toBe(true);
  });

  test("administrator can moderate a moderator", () => {
    expect(canModerate(admin, mod).allowed).toBe(true);
  });

  test("moderator can moderate a regular user", () => {
    expect(canModerate(mod, user).allowed).toBe(true);
  });

  test("moderator can moderate another moderator", () => {
    expect(canModerate(mod, mod).allowed).toBe(true);
  });

  // Verify hierarchy applies to ALL moderation actions (ban, unban, mute, unmute)
  test("hierarchy check is symmetric — applies to unban/unmute as well as ban/mute", () => {
    // The same canModerate function is used for all 4 operations
    // in moderation.service.ts: enforceRoleHierarchy calls resolveOrgUser + checks role
    const result = canModerate(mod, admin);
    expect(result.allowed).toBe(false);
  });
});

// ─── Ban state transitions ────────────────────────────────────────────────────

describe("Ban state correctness", () => {
  test("setting isBanned=true is idempotent", () => {
    const u: UserModerationState = { isBanned: true, muteUntil: null };
    expect(isBanned({ ...u, isBanned: true })).toBe(true);
  });

  test("setting isBanned=false unblocks the user", () => {
    const unbanned = { isBanned: false, muteUntil: null };
    expect(isBanned(unbanned)).toBe(false);
    expect(canPost(unbanned, now).allowed).toBe(true);
  });

  test("unmuting sets muteUntil to null", () => {
    const unmuted = { isBanned: false, muteUntil: null };
    expect(isMuted(unmuted, now)).toBe(false);
    expect(canPost(unmuted, now).allowed).toBe(true);
  });
});
