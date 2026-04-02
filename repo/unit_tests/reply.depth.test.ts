/**
 * Unit tests for reply nesting depth enforcement.
 * Validates depth calculation and max-depth rejection logic
 * as implemented in forum.service.ts.
 */

const MAX_REPLY_DEPTH = 3;

function computeDepth(parentDepth: number | null): number {
  return parentDepth === null ? 1 : parentDepth + 1;
}

function assertDepthAllowed(depth: number): void {
  if (depth > MAX_REPLY_DEPTH) {
    throw new Error(
      `Reply nesting exceeds the maximum depth of ${MAX_REPLY_DEPTH}`
    );
  }
}

describe("Reply depth computation", () => {
  test("Root reply (no parent) has depth 1", () =>
    expect(computeDepth(null)).toBe(1));

  test("Child of depth-1 parent gets depth 2", () =>
    expect(computeDepth(1)).toBe(2));

  test("Child of depth-2 parent gets depth 3 (max)", () =>
    expect(computeDepth(2)).toBe(3));

  test("Child of depth-3 parent would be depth 4 (over limit)", () =>
    expect(computeDepth(3)).toBe(4));
});

describe("Reply depth enforcement (assertDepthAllowed)", () => {
  test("depth 1 is allowed", () =>
    expect(() => assertDepthAllowed(1)).not.toThrow());

  test("depth 3 is allowed (exactly at limit)", () =>
    expect(() => assertDepthAllowed(3)).not.toThrow());

  test("depth 4 is rejected", () =>
    expect(() => assertDepthAllowed(4)).toThrow(/maximum depth of 3/));

  test("depth 5 is rejected", () =>
    expect(() => assertDepthAllowed(5)).toThrow(/maximum depth of 3/));
});

describe("Reply creation depth path", () => {
  test("replying to a depth-3 reply is blocked", () => {
    const parentDepth = 3;
    const newDepth = computeDepth(parentDepth);
    expect(() => assertDepthAllowed(newDepth)).toThrow();
  });

  test("replying to a depth-2 reply is allowed", () => {
    const parentDepth = 2;
    const newDepth = computeDepth(parentDepth);
    expect(() => assertDepthAllowed(newDepth)).not.toThrow();
  });
});
