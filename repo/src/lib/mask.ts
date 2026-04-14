/**
 * PII masking helpers — pure functions with zero external dependencies.
 * Extracted so they can be unit-tested without pulling in winston.
 */

/**
 * Masks an IPv4 or IPv6 address to prevent full IP logging.
 * IPv4: keeps first two octets, zeros the rest  → "192.168.x.x"
 * IPv6: keeps first group, zeros the rest       → "2001:x:x:x..."
 */
export function maskIp(ip: string): string {
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

/**
 * Recursively walks a log metadata object and applies masking rules:
 *   - password, passwordHash, token, authorization → [REDACTED]
 *   - ipAddress, ip, remoteAddress                 → masked (partial)
 *   - email                                         → [REDACTED]
 */
export function maskFields(obj: Record<string, unknown>): Record<string, unknown> {
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
