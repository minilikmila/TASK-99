/**
 * Reply nesting depth — pure logic.
 */

export function computeDepth(parentDepth: number | null): number {
  return parentDepth === null ? 1 : parentDepth + 1;
}

export function assertDepthAllowed(depth: number, maxDepth: number): void {
  if (depth > maxDepth) {
    throw new Error(
      `Reply nesting exceeds the maximum depth of ${maxDepth}`
    );
  }
}
