/**
 * In-memory sliding window rate limiter.
 * Limits are read from DB config (org-scoped) with env fallbacks.
 * Single-instance only — no distributed consistency.
 */
import { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { AppError } from "./errorHandler";
import { ErrorCode } from "../types";
import { getConfigValue, CONFIG_KEYS } from "../services/org-config.service";

interface WindowEntry {
  timestamps: number[];
}

const windows = new Map<string, WindowEntry>();

function isAllowed(key: string, limitPerMin: number): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const cutoff = now - windowMs;

  let entry = windows.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    windows.set(key, entry);
  }

  // Prune old entries
  entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);

  if (entry.timestamps.length >= limitPerMin) {
    return false;
  }

  entry.timestamps.push(now);
  return true;
}

// Periodically clean up stale keys to prevent unbounded memory growth
setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [key, entry] of windows.entries()) {
    if (entry.timestamps.every((ts) => ts < cutoff)) {
      windows.delete(key);
    }
  }
}, 60_000);

export async function readRateLimiter(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.user?.id ?? req.ip ?? "anonymous";
  const key = `read:${userId}`;
  // Read limit from DB config if org context is available, else env fallback
  let limit = config.rateLimit.readsPerMin;
  if (req.user?.organizationId) {
    try {
      limit = await getConfigValue(req.user.organizationId, CONFIG_KEYS.RATE_LIMIT_READS_PER_MIN);
    } catch { /* fallback to env */ }
  }
  if (!isAllowed(key, limit)) {
    return next(new AppError(429, ErrorCode.RATE_LIMITED, "Read rate limit exceeded"));
  }
  next();
}

export async function writeRateLimiter(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.user?.id ?? req.ip ?? "anonymous";
  const key = `write:${userId}`;
  let limit = config.rateLimit.writesPerMin;
  if (req.user?.organizationId) {
    try {
      limit = await getConfigValue(req.user.organizationId, CONFIG_KEYS.RATE_LIMIT_WRITES_PER_MIN);
    } catch { /* fallback to env */ }
  }
  if (!isAllowed(key, limit)) {
    return next(new AppError(429, ErrorCode.RATE_LIMITED, "Write rate limit exceeded"));
  }
  next();
}
