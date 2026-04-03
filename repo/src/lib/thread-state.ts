/**
 * Thread state machine — pure business logic.
 * Extracted so unit tests can import without triggering DB/config dependencies.
 */

export type ThreadState = "ACTIVE" | "LOCKED" | "ARCHIVED";

export const ALLOWED_TRANSITIONS: Partial<Record<ThreadState, ThreadState[]>> = {
  ACTIVE: ["LOCKED", "ARCHIVED"],
  LOCKED: ["ARCHIVED"],
  ARCHIVED: [], // irreversible
};

export function canTransition(from: ThreadState, to: ThreadState): boolean {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

export function assertTransitionAllowed(from: ThreadState, to: ThreadState): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Cannot transition thread from ${from} to ${to}`
    );
  }
}
