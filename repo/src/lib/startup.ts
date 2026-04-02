export const PLACEHOLDER_SECRET = "local-dev-secret-change-in-production-32chars";

/**
 * Validates required environment configuration for production startup.
 * Throws an Error (instead of calling process.exit) so the logic is testable.
 */
export function validateStartupConfig(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV !== "production") return;

  const secret = env.JWT_SECRET ?? "";
  if (!secret || secret === PLACEHOLDER_SECRET || secret.length < 32) {
    throw new Error(
      "[FATAL] JWT_SECRET must be set to a strong value (32+ chars) in production. Refusing to start."
    );
  }

  const internalKey = env.INTERNAL_API_KEY ?? "";
  if (!internalKey || internalKey.length < 32) {
    throw new Error(
      "[FATAL] INTERNAL_API_KEY must be set to a strong value (32+ chars) in production. Refusing to start."
    );
  }
}
