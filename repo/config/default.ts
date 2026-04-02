/**
 * Default application configuration values.
 * Actual runtime config is resolved from environment variables in src/config/index.ts.
 * This file serves as a reference for configurable defaults.
 */

export const defaults = {
  port: 3000,
  jwtExpiresIn: "8h",
  loginLockoutAttempts: 5,
  loginLockoutWindowMinutes: 15,
  writesPerMin: 120,
  readsPerMin: 600,
  maxPinnedPerSection: 3,
  maxReplyDepth: 3,
  recycleBinRetentionDays: 30,
  bulkActionMaxItems: 100,
  notificationMaxRetries: 3,
  notificationRetryWindowHours: 24,
  backupRetentionDays: 14,
};
