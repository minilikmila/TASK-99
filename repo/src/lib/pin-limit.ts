/**
 * Pin limit enforcement — pure decision logic.
 * Extracted so unit tests can validate production behavior directly.
 */

export function canPin(
  currentPinnedCount: number,
  maxPinned: number
): { allowed: boolean; reason?: string } {
  if (currentPinnedCount >= maxPinned) {
    return {
      allowed: false,
      reason: `Section already has the maximum of ${maxPinned} pinned threads`,
    };
  }
  return { allowed: true };
}
