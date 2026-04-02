/**
 * Unit tests for thread state transition rules.
 * Tests validate pure business logic without database access.
 */

type ThreadState = "ACTIVE" | "LOCKED" | "ARCHIVED";

const ALLOWED_TRANSITIONS: Record<ThreadState, ThreadState[]> = {
  ACTIVE: ["LOCKED", "ARCHIVED"],
  LOCKED: ["ARCHIVED"],
  ARCHIVED: [],
};

function canTransition(from: ThreadState, to: ThreadState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

function assertTransitionAllowed(from: ThreadState, to: ThreadState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Cannot transition thread from ${from} to ${to}`);
  }
}

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
