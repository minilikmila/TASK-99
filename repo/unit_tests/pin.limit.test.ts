/**
 * Unit tests for pin limit enforcement.
 * Imports production canPin from src/lib/pin-limit.ts.
 */

import { canPin } from "../src/lib/pin-limit";

const MAX_PINNED = 3;

describe("Pin Limit Enforcement (production module)", () => {
  test("First pin is allowed (0 existing)", () => {
    expect(canPin(0, MAX_PINNED).allowed).toBe(true);
  });

  test("Second pin is allowed (1 existing)", () => {
    expect(canPin(1, MAX_PINNED).allowed).toBe(true);
  });

  test("Third pin is allowed (2 existing)", () => {
    expect(canPin(2, MAX_PINNED).allowed).toBe(true);
  });

  test("Fourth pin is rejected (3 existing)", () => {
    const result = canPin(3, MAX_PINNED);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("maximum of 3");
  });

  test("Fifth pin is rejected (4 existing — safety check)", () => {
    expect(canPin(4, MAX_PINNED).allowed).toBe(false);
  });

  test("configurable max — maxPinned=5 allows 4 existing", () => {
    expect(canPin(4, 5).allowed).toBe(true);
    expect(canPin(5, 5).allowed).toBe(false);
  });
});
