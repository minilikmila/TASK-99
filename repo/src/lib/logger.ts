import winston from "winston";
import { config } from "../config";

// ─── PII masking helpers ──────────────────────────────────────────────────────

/**
 * Masks an IPv4 or IPv6 address to prevent full IP logging.
 * IPv4: keeps first two octets, zeros the rest  → "192.168.x.x"
 * IPv6: keeps first group, zeros the rest       → "2001:x:x:x..."
 */
function maskIp(ip: string): string {
  if (!ip || ip === "unknown") return ip;

  // IPv4
  const v4 = ip.match(/^(\d{1,3}\.\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (v4) return `${v4[1]}.x.x`;

  // IPv4-mapped IPv6 ::ffff:x.x.x.x
  const v4mapped = ip.match(/^::ffff:(\d{1,3}\.\d{1,3})\.\d{1,3}\.\d{1,3}$/i);
  if (v4mapped) return `::ffff:${v4mapped[1]}.x.x`;

  // IPv6 — keep first segment only
  const v6parts = ip.split(":");
  if (v6parts.length > 1) return `${v6parts[0]}:x:x:x:x:x:x:x`;

  return "[masked-ip]";
}

/**
 * Recursively walks a log metadata object and applies masking rules:
 *   - password, passwordHash, token, authorization → [REDACTED]
 *   - ipAddress, ip, remoteAddress                 → masked (partial)
 *   - email                                         → [REDACTED]
 */
function maskFields(obj: Record<string, unknown>): Record<string, unknown> {
  const REDACT = new Set([
    "password",
    "passwordHash",
    "token",
    "authorization",
    "email",
    "secret",
    "apiKey",
    "x-internal-key",
  ]);
  const MASK_IP = new Set(["ipAddress", "ip", "remoteAddress", "clientIp"]);

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const lk = k.toLowerCase();
    if (REDACT.has(k) || REDACT.has(lk)) {
      result[k] = "[REDACTED]";
    } else if (MASK_IP.has(k) || MASK_IP.has(lk)) {
      result[k] = typeof v === "string" ? maskIp(v) : v;
    } else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      result[k] = maskFields(v as Record<string, unknown>);
    } else {
      result[k] = v;
    }
  }
  return result;
}

const maskSensitive = winston.format((info) => {
  return maskFields(info as unknown as Record<string, unknown>) as typeof info;
});

// ─── Logger ───────────────────────────────────────────────────────────────────

const useJsonLogs =
  config.env === "production" || config.env === "test";

export const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    maskSensitive(),
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    useJsonLogs
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(
            ({ timestamp, level, message, correlationId, ...meta }) => {
              const cid = correlationId ? ` [${correlationId}]` : "";
              const metaStr =
                Object.keys(meta).length > 0
                  ? ` ${JSON.stringify(meta)}`
                  : "";
              return `${timestamp} ${level}${cid}: ${message}${metaStr}`;
            }
          )
        )
  ),
  transports: [new winston.transports.Console()],
});

// Export masking utilities for use in other security-sensitive contexts
export { maskIp };
