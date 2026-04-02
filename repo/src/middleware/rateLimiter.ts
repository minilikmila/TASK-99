/**
 * In-memory sliding window rate limiter.
 * Single-instance only — no distributed consistency.
 */
import { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { AppError } from "./errorHandler";
import { ErrorCode } from "../types";

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

export function readRateLimiter(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const userId = req.user?.id ?? req.ip ?? "anonymous";
  const key = `read:${userId}`;
  if (!isAllowed(key, config.rateLimit.readsPerMin)) {
    throw new AppError(429, ErrorCode.RATE_LIMITED, "Read rate limit exceeded");
  }
  next();
}

export function writeRateLimiter(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const userId = req.user?.id ?? req.ip ?? "anonymous";
  const key = `write:${userId}`;
  if (!isAllowed(key, config.rateLimit.writesPerMin)) {
    throw new AppError(
      429,
      ErrorCode.RATE_LIMITED,
      "Write rate limit exceeded"
    );
  }
  next();
}
