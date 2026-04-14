/**
 * Manual Jest mock for @prisma/client.
 * Provides enum values used by Zod schemas so unit tests can import
 * production schemas without requiring a generated Prisma client.
 */

export enum ThreadState {
  ACTIVE = "ACTIVE",
  LOCKED = "LOCKED",
  ARCHIVED = "ARCHIVED",
}

export enum Role {
  ADMINISTRATOR = "ADMINISTRATOR",
  MODERATOR = "MODERATOR",
  ANALYST = "ANALYST",
  USER = "USER",
}

export enum RiskFlagStatus {
  OPEN = "OPEN",
  REVIEWED = "REVIEWED",
  DISMISSED = "DISMISSED",
}

export enum RecycleBinItemType {
  THREAD = "THREAD",
  REPLY = "REPLY",
}

export enum NotificationStatus {
  PENDING = "PENDING",
  DELIVERED = "DELIVERED",
  FAILED = "FAILED",
  OPENED = "OPENED",
}
