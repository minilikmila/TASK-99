import bcrypt from "bcryptjs";
import { config } from "../config";
import { AppError } from "../middleware/errorHandler";
import { ErrorCode, AuthenticatedUser } from "../types";
import { signToken } from "../middleware/auth";
import { organizationRepository } from "../repositories/organization.repository";
import { userRepository } from "../repositories/user.repository";
import { auditRepository } from "../repositories/audit.repository";
import { analyticsService, EVENT } from "./analytics.service";
import { getConfigValue, CONFIG_KEYS } from "./org-config.service";
import type { LoginInput } from "../schemas/auth.schema";

export async function login(
  input: LoginInput & { ipAddress?: string }
): Promise<{ user: AuthenticatedUser; token: string }> {
  const { organizationSlug, username, password, ipAddress } = input;

  // 1. Resolve organization
  const org = await organizationRepository.findBySlug(organizationSlug);
  if (!org || !org.isActive) {
    // Record attempt even when org not found to prevent enumeration timing attacks
    await userRepository.createLoginAttempt({
      username,
      orgSlug: organizationSlug,
      success: false,
      ipAddress,
    });
    throw new AppError(401, ErrorCode.UNAUTHORIZED, "Invalid credentials");
  }

  // 2. Check lockout window — thresholds from DB config (org-scoped)
  const lockoutAttempts = await getConfigValue(org.id, CONFIG_KEYS.AUTH_LOCKOUT_ATTEMPTS);
  const lockoutWindowMin = await getConfigValue(org.id, CONFIG_KEYS.AUTH_LOCKOUT_WINDOW_MINUTES);
  const windowStart = new Date(Date.now() - lockoutWindowMin * 60_000);
  const recentFailures = await userRepository.countRecentFailedAttempts(
    username,
    organizationSlug,
    windowStart
  );
  if (recentFailures >= lockoutAttempts) {
    throw new AppError(
      429,
      ErrorCode.ACCOUNT_LOCKED,
      `Account locked — too many failed attempts. Try again after ${lockoutWindowMin} minutes.`
    );
  }

  // 3. Find user
  const user = await userRepository.findByOrgAndUsername(org.id, username);
  const credentialsValid =
    user !== null && (await bcrypt.compare(password, user.passwordHash));

  // 4. Always record the attempt (before throwing — avoids leaking timing)
  await userRepository.createLoginAttempt({
    userId: user?.id,
    username,
    orgSlug: organizationSlug,
    success: credentialsValid,
    ipAddress,
  });

  if (!credentialsValid) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, "Invalid credentials");
  }

  // 5. Ban check after credential verification
  if (user!.isBanned) {
    throw new AppError(403, ErrorCode.USER_BANNED, "Account is banned");
  }

  // 6. Audit successful login
  await auditRepository.create({
    organizationId: org.id,
    actorId: user!.id,
    eventType: "user.login",
    resourceType: "User",
    resourceId: user!.id,
    ipAddress,
  });

  const principal: AuthenticatedUser = {
    id: user!.id,
    organizationId: org.id,
    username: user!.username,
    role: user!.role,
    isBanned: user!.isBanned,
    muteUntil: user!.muteUntil,
  };

  // Sign token with tokenVersion for invalidation support
  const token = signToken({
    id: user!.id,
    organizationId: org.id,
    tokenVersion: user!.tokenVersion,
  });

  return { user: principal, token };
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

/**
 * Called by admin user-creation flow to record the registration funnel event.
 */
export async function recordUserRegistered(
  organizationId: string,
  userId: string
): Promise<void> {
  void analyticsService.recordEvent({
    organizationId,
    userId,
    eventType: EVENT.USER_REGISTERED,
    resourceType: "User",
    resourceId: userId,
  });
}
