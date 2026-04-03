import { User, Thread, RiskFlagStatus } from "@prisma/client";
import { userRepository } from "../repositories/user.repository";
import { threadRepository } from "../repositories/thread.repository";
import { recycleRepository } from "../repositories/recycle.repository";
import { auditRepository } from "../repositories/audit.repository";
import { notifyModerationAction } from "./notification.service";
import { AppError } from "../middleware/errorHandler";
import { ErrorCode } from "../types";
import { getConfigValue, CONFIG_KEYS } from "./org-config.service";
import type {
  MuteInput,
  BulkContentInput,
  UpdateRiskFlagInput,
} from "../schemas/moderation.schema";
import { prisma } from "../lib/prisma";
import { RecycleBinItemWithContent } from "../repositories/recycle.repository";

// ─── Ban / Unban ──────────────────────────────────────────────────────────────

export async function banUser(
  targetUserId: string,
  organizationId: string,
  actorId: string,
  ipAddress?: string
): Promise<User> {
  const target = await resolveOrgUser(targetUserId, organizationId);
  await enforceRoleHierarchy(actorId, target, organizationId);

  const updated = await userRepository.update(targetUserId, {
    isBanned: true,
    tokenVersion: { increment: 1 },
  });

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "user.banned",
    resourceType: "User",
    resourceId: targetUserId,
    ipAddress,
  });

  void notifyModerationAction(targetUserId, organizationId, "banned", {});

  return updated;
}

export async function unbanUser(
  targetUserId: string,
  organizationId: string,
  actorId: string,
  ipAddress?: string
): Promise<User> {
  const target = await resolveOrgUser(targetUserId, organizationId);
  await enforceRoleHierarchy(actorId, target, organizationId);

  const updated = await userRepository.update(targetUserId, {
    isBanned: false,
    tokenVersion: { increment: 1 },
  });

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "user.unbanned",
    resourceType: "User",
    resourceId: targetUserId,
    ipAddress,
  });

  void notifyModerationAction(targetUserId, organizationId, "unbanned", {});

  return updated;
}

// ─── Mute / Unmute ────────────────────────────────────────────────────────────

export async function muteUser(
  targetUserId: string,
  organizationId: string,
  actorId: string,
  input: MuteInput,
  ipAddress?: string
): Promise<User> {
  const target = await resolveOrgUser(targetUserId, organizationId);
  await enforceRoleHierarchy(actorId, target, organizationId);

  const muteUntil = new Date(Date.now() + input.durationHours * 3_600_000);
  const updated = await userRepository.update(targetUserId, {
    muteUntil,
    tokenVersion: { increment: 1 },
  });

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "user.muted",
    resourceType: "User",
    resourceId: targetUserId,
    details: {
      durationHours: input.durationHours,
      reason: input.reason,
      muteUntil: muteUntil.toISOString(),
    },
    ipAddress,
  });

  void notifyModerationAction(targetUserId, organizationId, "muted", {
    reason: input.reason,
    muteUntil: muteUntil.toISOString(),
  });

  return updated;
}

export async function unmuteUser(
  targetUserId: string,
  organizationId: string,
  actorId: string,
  ipAddress?: string
): Promise<User> {
  const target = await resolveOrgUser(targetUserId, organizationId);
  await enforceRoleHierarchy(actorId, target, organizationId);

  const updated = await userRepository.update(targetUserId, {
    muteUntil: null,
    tokenVersion: { increment: 1 },
  });

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "user.unmuted",
    resourceType: "User",
    resourceId: targetUserId,
    ipAddress,
  });

  void notifyModerationAction(targetUserId, organizationId, "unmuted", {});

  return updated;
}

// ─── Bulk Content ─────────────────────────────────────────────────────────────

export interface BulkActionResult {
  id: string;
  status: "ok" | "skipped" | "failed";
  reason?: string;
}

export async function bulkContentAction(
  organizationId: string,
  actorId: string,
  input: BulkContentInput
): Promise<BulkActionResult[]> {
  const results: BulkActionResult[] = [];

  for (const threadId of input.threadIds) {
    try {
      const thread = await threadRepository.findById(threadId, organizationId);
      if (!thread) {
        results.push({ id: threadId, status: "skipped", reason: "not found" });
        continue;
      }

      if (input.action === "archive_threads") {
        if (thread.state === "ARCHIVED") {
          results.push({ id: threadId, status: "skipped", reason: "already archived" });
          continue;
        }
        await threadRepository.update(threadId, { state: "ARCHIVED" });
      } else if (input.action === "lock_threads") {
        if (thread.state !== "ACTIVE") {
          results.push({ id: threadId, status: "skipped", reason: `state is ${thread.state}` });
          continue;
        }
        await threadRepository.update(threadId, { state: "LOCKED" });
      } else if (input.action === "delete_threads") {
        const retentionDays = await getConfigValue(organizationId, CONFIG_KEYS.RECYCLE_BIN_RETENTION_DAYS);
        const now = new Date();
        const expiresAt = new Date(
          now.getTime() + retentionDays * 86_400_000
        );
        await threadRepository.softDelete(threadId, now);
        await recycleRepository.create({
          organizationId,
          itemType: "THREAD",
          threadId,
          deletedById: actorId,
          deletedAt: now,
          expiresAt,
        });
      }

      await auditRepository.create({
        organizationId,
        actorId,
        eventType: `thread.bulk_${input.action}`,
        resourceType: "Thread",
        resourceId: threadId,
      });

      // Emit per-entity event so risk engine aggregation counts bulk operations.
      // e.g. bulk_delete_threads also emits thread.deleted for each thread.
      if (input.action === "delete_threads") {
        await auditRepository.create({
          organizationId,
          actorId,
          eventType: "thread.deleted",
          resourceType: "Thread",
          resourceId: threadId,
        });
      }

      results.push({ id: threadId, status: "ok" });
    } catch (err) {
      results.push({
        id: threadId,
        status: "failed",
        reason: (err as Error).message,
      });
    }
  }

  return results;
}

// ─── Recycle Bin ──────────────────────────────────────────────────────────────

export async function listRecycleBin(
  organizationId: string
): Promise<RecycleBinItemWithContent[]> {
  return recycleRepository.findActiveByOrg(organizationId, new Date());
}

export async function restoreItem(
  itemId: string,
  organizationId: string,
  actorId: string
): Promise<void> {
  const item = await recycleRepository.findByIdInOrg(itemId, organizationId);

  if (!item || item.expiresAt < new Date()) {
    throw new AppError(
      404,
      ErrorCode.NOT_FOUND,
      "Recycle bin item not found or has expired"
    );
  }

  if (item.itemType === "THREAD" && item.thread) {
    await threadRepository.update(item.thread.id, { deletedAt: null });
  } else if (item.itemType === "REPLY" && item.reply) {
    // Dependency check: thread must still exist and not be deleted
    const parentThread = await threadRepository.findById(
      item.reply.threadId,
      organizationId
    );
    if (!parentThread) {
      throw new AppError(
        409,
        ErrorCode.DEPENDENCY_MISSING,
        "Cannot restore reply: parent thread no longer exists"
      );
    }
    await prisma.reply.update({
      where: { id: item.reply.id },
      data: { deletedAt: null },
    });
  }

  await recycleRepository.delete(itemId);

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "recycle_bin.restored",
    resourceType: item.itemType,
    resourceId: item.thread?.id ?? item.reply?.id,
  });
}

export async function purgeItem(
  itemId: string,
  organizationId: string,
  actorId: string
): Promise<void> {
  const item = await recycleRepository.findByIdInOrg(itemId, organizationId);
  if (!item) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Recycle bin item not found");
  }

  await recycleRepository.delete(itemId);

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "recycle_bin.purged",
    resourceType: item.itemType,
    resourceId: item.thread?.id ?? item.reply?.id,
  });
}

// ─── Risk flags ───────────────────────────────────────────────────────────────

export async function listRiskFlags(
  organizationId: string,
  status?: RiskFlagStatus
) {
  return prisma.riskFlag.findMany({
    where: {
      organizationId,
      ...(status && { status }),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateRiskFlag(
  flagId: string,
  organizationId: string,
  actorId: string,
  input: UpdateRiskFlagInput
) {
  const existing = await prisma.riskFlag.findFirst({
    where: { id: flagId, organizationId },
  });
  if (!existing) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Risk flag not found");
  }

  const updated = await prisma.riskFlag.update({
    where: { id: flagId },
    data: { status: input.status },
  });

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "risk_flag.updated",
    resourceType: "RiskFlag",
    resourceId: flagId,
    details: { status: input.status },
  });

  return updated;
}

// ─── Role management ──────────────────────────────────────────────────────────

export async function changeUserRole(
  targetUserId: string,
  organizationId: string,
  actorId: string,
  newRole: string
): Promise<User> {
  const target = await resolveOrgUser(targetUserId, organizationId);

  const updated = await userRepository.update(targetUserId, {
    role: newRole as User["role"],
    tokenVersion: { increment: 1 },
  });

  // Permission change — always audit
  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "user.role_changed",
    resourceType: "User",
    resourceId: targetUserId,
    details: { previousRole: target.role, newRole },
  });

  return updated;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveOrgUser(userId: string, organizationId: string): Promise<User> {
  const user = await userRepository.findByIdInOrg(userId, organizationId);
  if (!user) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "User not found");
  }
  return user;
}

async function enforceRoleHierarchy(
  actorId: string,
  target: User,
  organizationId: string
): Promise<void> {
  if (target.role === "ADMINISTRATOR") {
    const actor = await resolveOrgUser(actorId, organizationId);
    if (actor.role !== "ADMINISTRATOR") {
      throw new AppError(
        403,
        ErrorCode.FORBIDDEN,
        "Only administrators can ban or mute other administrators"
      );
    }
  }
}
