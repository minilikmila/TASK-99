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
 * Validates required environment configuration for production startup.
 * Throws an Error (instead of calling process.exit) so the logic is testable.
 */
export function validateStartupConfig(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV !== "production") return;

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
