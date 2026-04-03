/**
 * Unit tests for thread state transition rules.
 * Imports production functions directly from the thread-state lib module.
 */

import { canTransition, assertTransitionAllowed } from "../src/lib/thread-state";

describe("Thread State Transitions — allowed", () => {
  test("ACTIVE → LOCKED", () =>
    expect(canTransition("ACTIVE", "LOCKED")).toBe(true));

  test("ACTIVE → ARCHIVED", () =>
    expect(canTransition("ACTIVE", "ARCHIVED")).toBe(true));

  test("LOCKED → ARCHIVED", () =>
    expect(canTransition("LOCKED", "ARCHIVED")).toBe(true));
});

describe("Thread State Transitions — disallowed", () => {
  test("ARCHIVED → ACTIVE is irreversible", () =>
    expect(canTransition("ARCHIVED", "ACTIVE")).toBe(false));

  test("ARCHIVED → LOCKED is irreversible", () =>
    expect(canTransition("ARCHIVED", "LOCKED")).toBe(false));

  test("LOCKED → ACTIVE (no rollback)", () =>
    expect(canTransition("LOCKED", "ACTIVE")).toBe(false));

  test("ACTIVE → ACTIVE (no self-transition)", () =>
    expect(canTransition("ACTIVE", "ACTIVE")).toBe(false));
});

describe("assertTransitionAllowed", () => {
  test("does not throw on valid transition", () =>
    expect(() => assertTransitionAllowed("ACTIVE", "LOCKED")).not.toThrow());

  test("throws descriptive error on invalid transition", () =>
    expect(() => assertTransitionAllowed("ARCHIVED", "ACTIVE")).toThrow(
      /Cannot transition thread from ARCHIVED to ACTIVE/
    ));
});
