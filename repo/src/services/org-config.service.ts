/**
 * Organization-scoped configuration — DB-driven with fallback defaults.
 *
 * Every operational config value is stored as a FeatureFlag record.
 * The `description` field holds the numeric/string value; `value` (boolean)
 * indicates whether the config entry is active.
 *
 * This replaces hardcoded config.* values with per-org DB reads,
 * allowing runtime tuning without redeployment.
 */

import { featureFlagRepository } from "../repositories/feature-flag.repository";

// ─── Config keys and their hardcoded fallback defaults ───────────────────────

export const CONFIG_KEYS = {
  // Forum
  MAX_PINNED_PER_SECTION: "forum.max_pinned_per_section",
  MAX_REPLY_DEPTH: "forum.max_reply_depth",
  RECYCLE_BIN_RETENTION_DAYS: "forum.recycle_bin_retention_days",
  BULK_ACTION_MAX_ITEMS: "forum.bulk_action_max_items",
  MUTE_DURATION_MIN_HOURS: "forum.mute_duration_min_hours",
  MUTE_DURATION_MAX_HOURS: "forum.mute_duration_max_hours",
  // Auth lockout
  AUTH_LOCKOUT_ATTEMPTS: "auth.lockout_attempts",
  AUTH_LOCKOUT_WINDOW_MINUTES: "auth.lockout_window_minutes",
  // Rate limits
  RATE_LIMIT_WRITES_PER_MIN: "rate_limit.writes_per_min",
  RATE_LIMIT_READS_PER_MIN: "rate_limit.reads_per_min",
  // Notification retry
  NOTIFICATION_MAX_RETRIES: "notification.max_retries",
  NOTIFICATION_RETRY_DELAY_1: "notification.retry_delay_1_min",
  NOTIFICATION_RETRY_DELAY_2: "notification.retry_delay_2_min",
  NOTIFICATION_RETRY_DELAY_3: "notification.retry_delay_3_min",
  NOTIFICATION_RETRY_WINDOW_HOURS: "notification.retry_window_hours",
  // Backup
  BACKUP_RETENTION_DAYS: "backup.retention_days",
} as const;

const DEFAULTS: Record<string, number> = {
  [CONFIG_KEYS.MAX_PINNED_PER_SECTION]: 3,
  [CONFIG_KEYS.MAX_REPLY_DEPTH]: 3,
  [CONFIG_KEYS.RECYCLE_BIN_RETENTION_DAYS]: 30,
  [CONFIG_KEYS.BULK_ACTION_MAX_ITEMS]: 100,
  [CONFIG_KEYS.MUTE_DURATION_MIN_HOURS]: 24,
  [CONFIG_KEYS.MUTE_DURATION_MAX_HOURS]: 720,
  [CONFIG_KEYS.AUTH_LOCKOUT_ATTEMPTS]: 5,
  [CONFIG_KEYS.AUTH_LOCKOUT_WINDOW_MINUTES]: 15,
  [CONFIG_KEYS.RATE_LIMIT_WRITES_PER_MIN]: 120,
  [CONFIG_KEYS.RATE_LIMIT_READS_PER_MIN]: 600,
  [CONFIG_KEYS.NOTIFICATION_MAX_RETRIES]: 3,
  [CONFIG_KEYS.NOTIFICATION_RETRY_DELAY_1]: 1,
  [CONFIG_KEYS.NOTIFICATION_RETRY_DELAY_2]: 5,
  [CONFIG_KEYS.NOTIFICATION_RETRY_DELAY_3]: 30,
  [CONFIG_KEYS.NOTIFICATION_RETRY_WINDOW_HOURS]: 24,
  [CONFIG_KEYS.BACKUP_RETENTION_DAYS]: 14,
};

/**
 * Read a numeric config value from DB, falling back to the hardcoded default.
 * The value is stored in the FeatureFlag `description` field as a numeric string.
 */
export async function getConfigValue(
  organizationId: string,
  key: string
): Promise<number> {
  const flag = await featureFlagRepository.findByKey(organizationId, key);
  if (flag?.description) {
    const n = parseInt(flag.description, 10);
    if (!isNaN(n)) return n;
  }
  return DEFAULTS[key] ?? 0;
}

/**
 * Get notification retry delay schedule from DB config.
 */
export async function getRetryDelays(organizationId: string): Promise<number[]> {
  const [d1, d2, d3] = await Promise.all([
    getConfigValue(organizationId, CONFIG_KEYS.NOTIFICATION_RETRY_DELAY_1),
    getConfigValue(organizationId, CONFIG_KEYS.NOTIFICATION_RETRY_DELAY_2),
    getConfigValue(organizationId, CONFIG_KEYS.NOTIFICATION_RETRY_DELAY_3),
  ]);
  return [d1, d2, d3];
}
