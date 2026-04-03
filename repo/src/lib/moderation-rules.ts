/**
 * Moderation pure logic — ban/mute state checks and role hierarchy.
 * Extracted so unit tests can validate production behavior directly.
 */

export interface UserModerationState {
  isBanned: boolean;
  muteUntil: Date | null;
}

export interface RoleUser extends UserModerationState {
  role: "ADMINISTRATOR" | "MODERATOR" | "ANALYST" | "USER";
}

export function isBanned(user: UserModerationState): boolean {
  return user.isBanned;
}

export function isMuted(user: UserModerationState, now: Date): boolean {
  return user.muteUntil !== null && user.muteUntil > now;
}

export function canPost(
  user: UserModerationState,
  now: Date
): { allowed: boolean; reason?: string } {
  if (isBanned(user)) return { allowed: false, reason: "USER_BANNED" };
  if (isMuted(user, now)) return { allowed: false, reason: "USER_MUTED" };
  return { allowed: true };
}

export function validateMuteDuration(
  hours: number,
  minHours = 24,
  maxHours = 720
): string | null {
  if (!Number.isInteger(hours)) return "durationHours must be an integer";
  if (hours < minHours) return `Minimum mute duration is ${minHours} hours`;
  if (hours > maxHours) return `Maximum mute duration is ${maxHours} hours`;
  return null;
}

export function canModerate(
  actor: RoleUser,
  target: RoleUser
): { allowed: boolean; reason?: string } {
  if (target.role === "ADMINISTRATOR" && actor.role !== "ADMINISTRATOR") {
    return { allowed: false, reason: "FORBIDDEN" };
  }
  return { allowed: true };
}
