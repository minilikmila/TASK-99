/**
 * Local log-threshold alerting.
 *
 * Monitors error/warning counts over sliding windows and emits
 * "alert"-level log entries when thresholds are exceeded.
 * No external services — purely local log-based alerting as required
 * by the prompt ("alerting via local log thresholds only").
 */

import { logger } from "../lib/logger";
import { config } from "../config";

// ─── Sliding window counters ─────────────────────────────────────────────────

interface Counter {
  timestamps: number[];
}

const counters: Record<string, Counter> = {
  error: { timestamps: [] },
  auth_failure: { timestamps: [] },
  rate_limited: { timestamps: [] },
};

const WINDOW_MS = config.alerts.windowMinutes * 60_000;

function prune(counter: Counter, now: number): void {
  const cutoff = now - WINDOW_MS;
  counter.timestamps = counter.timestamps.filter((ts) => ts > cutoff);
}

// ─── Public: record an event ─────────────────────────────────────────────────

export function recordAlertEvent(category: keyof typeof counters): void {
  const now = Date.now();
  const counter = counters[category];
  if (!counter) return;
  counter.timestamps.push(now);
}

// ─── Thresholds ──────────────────────────────────────────────────────────────

interface AlertRule {
  category: keyof typeof counters;
  threshold: number;
  message: string;
}

const ALERT_RULES: AlertRule[] = [
  {
    category: "error",
    threshold: config.alerts.errorThreshold,
    message: `High error rate: ≥${config.alerts.errorThreshold} errors in ${config.alerts.windowMinutes} minutes`,
  },
  {
    category: "auth_failure",
    threshold: config.alerts.authFailureThreshold,
    message: `High auth failure rate: ≥${config.alerts.authFailureThreshold} auth failures in ${config.alerts.windowMinutes} minutes`,
  },
  {
    category: "rate_limited",
    threshold: config.alerts.rateLimitedThreshold,
    message: `Excessive rate limiting: ≥${config.alerts.rateLimitedThreshold} 429 responses in ${config.alerts.windowMinutes} minutes`,
  },
];

// ─── Check thresholds (called by scheduler) ──────────────────────────────────

export function checkAlertThresholds(): void {
  const now = Date.now();

  for (const rule of ALERT_RULES) {
    const counter = counters[rule.category];
    prune(counter, now);

    if (counter.timestamps.length >= rule.threshold) {
      logger.warn(`[ALERT] ${rule.message}`, {
        alertCategory: rule.category,
        count: counter.timestamps.length,
        threshold: rule.threshold,
        windowMinutes: WINDOW_MS / 60_000,
      });
    }
  }
}
