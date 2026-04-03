/**
 * Unit tests for reply nesting depth enforcement.
 * Imports production functions from src/lib/reply-depth.ts.
 */

import { computeDepth, assertDepthAllowed } from "../src/lib/reply-depth";

const MAX_REPLY_DEPTH = 3;

describe("Reply depth computation (production module)", () => {
  test("Root reply (no parent) has depth 1", () =>
    expect(computeDepth(null)).toBe(1));

  test("Child of depth-1 parent gets depth 2", () =>
    expect(computeDepth(1)).toBe(2));

  test("Child of depth-2 parent gets depth 3 (max)", () =>
    expect(computeDepth(2)).toBe(3));

  test("Child of depth-3 parent would be depth 4 (over limit)", () =>
    expect(computeDepth(3)).toBe(4));
});

describe("Reply depth enforcement (production module)", () => {
  test("depth 1 is allowed", () =>
    expect(() => assertDepthAllowed(1, MAX_REPLY_DEPTH)).not.toThrow());

  test("depth 3 is allowed (exactly at limit)", () =>
    expect(() => assertDepthAllowed(3, MAX_REPLY_DEPTH)).not.toThrow());

  test("depth 4 is rejected", () =>
    expect(() => assertDepthAllowed(4, MAX_REPLY_DEPTH)).toThrow(/maximum depth of 3/));

  test("depth 5 is rejected", () =>
    expect(() => assertDepthAllowed(5, MAX_REPLY_DEPTH)).toThrow(/maximum depth of 3/));
});

describe("Reply creation depth path", () => {
  test("replying to a depth-3 reply is blocked", () => {
    const newDepth = computeDepth(3);
    expect(() => assertDepthAllowed(newDepth, MAX_REPLY_DEPTH)).toThrow();
  });

  test("replying to a depth-2 reply is allowed", () => {
    const newDepth = computeDepth(2);
    expect(() => assertDepthAllowed(newDepth, MAX_REPLY_DEPTH)).not.toThrow();
  });
});
