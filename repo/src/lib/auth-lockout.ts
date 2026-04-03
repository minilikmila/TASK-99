/**
 * Authentication lockout — pure decision logic.
 * Extracted so unit tests can import without triggering DB/config dependencies.
 */

/**
 * Determines if a user account should be locked out based on
 * recent failure count vs the configured max attempts threshold.
 */
export function isLockedOut(
  recentFailures: number,
  maxAttempts: number
): boolean {
  return recentFailures >= maxAttempts;
}
