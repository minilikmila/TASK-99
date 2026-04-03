/**
 * Unit tests for authentication lockout logic.
 * Imports the production isLockedOut function from the auth-lockout lib module.
 */

import { isLockedOut } from "../src/lib/auth-lockout";

const LOCKOUT_ATTEMPTS = 5;

describe("Login lockout — isLockedOut (production function)", () => {
  test("0 failures → no lockout", () => {
    expect(isLockedOut(0, LOCKOUT_ATTEMPTS)).toBe(false);
  });

  test("4 recent failures → no lockout", () => {
    expect(isLockedOut(4, LOCKOUT_ATTEMPTS)).toBe(false);
  });

  test("5 recent failures → locked out", () => {
    expect(isLockedOut(5, LOCKOUT_ATTEMPTS)).toBe(true);
  });

  test("6 recent failures → still locked out", () => {
    expect(isLockedOut(6, LOCKOUT_ATTEMPTS)).toBe(true);
  });

  test("exactly at threshold → locked", () => {
    expect(isLockedOut(LOCKOUT_ATTEMPTS, LOCKOUT_ATTEMPTS)).toBe(true);
  });

  test("one below threshold → not locked", () => {
    expect(isLockedOut(LOCKOUT_ATTEMPTS - 1, LOCKOUT_ATTEMPTS)).toBe(false);
  });

  test("custom threshold of 3 — 3 failures → locked", () => {
    expect(isLockedOut(3, 3)).toBe(true);
  });
});
