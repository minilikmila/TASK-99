export const PLACEHOLDER_SECRET = "local-dev-secret-change-in-production-32chars";

/**
 * Reject any secret that starts with a known dev/default prefix.
 * This catches docker-compose defaults even if they are long enough to pass
 * the 32-char minimum.
 */
const REJECTED_PREFIXES = [
  "local-dev-",
  "dev-secret-",
  "change-me",
  "test-",
];

export function isWeakSecret(value: string): boolean {
  if (value === PLACEHOLDER_SECRET) return true;
  const lower = value.toLowerCase();
  return REJECTED_PREFIXES.some((p) => lower.startsWith(p));
}

/**
 * Validates required environment configuration at startup.
 *
 * - production: throws (refuses to start) if secrets are missing or weak.
 * - development / test: skips validation (dev defaults are tolerated).
 * - any other NODE_ENV (e.g. staging): throws if secrets are weak, same as production.
 */
export function validateStartupConfig(env: NodeJS.ProcessEnv): void {
  const nodeEnv = env.NODE_ENV ?? "development";

  // Development and test environments tolerate weak/missing secrets
  if (nodeEnv === "development" || nodeEnv === "test") return;

  const secret = env.JWT_SECRET ?? "";
  if (!secret || secret.length < 32 || isWeakSecret(secret)) {
    throw new Error(
      "[FATAL] JWT_SECRET must be set to a strong, non-default value (32+ chars) in production. Refusing to start."
    );
  }

  const internalKey = env.INTERNAL_API_KEY ?? "";
  if (!internalKey || internalKey.length < 32 || isWeakSecret(internalKey)) {
    throw new Error(
      "[FATAL] INTERNAL_API_KEY must be set to a strong, non-default value (32+ chars) in production. Refusing to start."
    );
  }
}
