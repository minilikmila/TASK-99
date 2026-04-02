/**
 * Unit tests for pinned thread limit enforcement.
 */

const MAX_PINNED = 3;

function canPin(currentPinnedCount: number): { allowed: boolean; reason?: string } {
  if (currentPinnedCount >= MAX_PINNED) {
    return {
      allowed: false,
      reason: `Section already has ${MAX_PINNED} pinned threads`,
    };
  }
  return { allowed: true };
}

describe("Pin Limit Enforcement", () => {
  test("First pin is allowed (0 existing)", () => {
    expect(canPin(0).allowed).toBe(true);
  });

  test("Second pin is allowed (1 existing)", () => {
    expect(canPin(1).allowed).toBe(true);
  });

  test("Third pin is allowed (2 existing)", () => {
    expect(canPin(2).allowed).toBe(true);
  });

  test("Fourth pin is rejected (3 existing)", () => {
    const result = canPin(3);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("3 pinned threads");
  });

  test("Fifth pin is rejected (4 existing — safety check)", () => {
    expect(canPin(4).allowed).toBe(false);
  });
});
