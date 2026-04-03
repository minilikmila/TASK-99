import { Thread, ThreadState } from "@prisma/client";
import { threadRepository, ThreadWithIncludes } from "../repositories/thread.repository";
import { replyRepository, ReplyWithAuthor } from "../repositories/reply.repository";
import { recycleRepository } from "../repositories/recycle.repository";
import { auditRepository } from "../repositories/audit.repository";
import { sectionRepository } from "../repositories/section.repository";
import { tagRepository } from "../repositories/tag.repository";
import { notifyNewReply } from "./notification.service";
import { analyticsService, EVENT } from "./analytics.service";
import { getConfigValue, CONFIG_KEYS } from "./org-config.service";
import { AppError } from "../middleware/errorHandler";
import { ErrorCode } from "../types";
import { prisma } from "../lib/prisma";
import type {
  CreateThreadInput,
  UpdateThreadInput,
  ThreadStateInput,
  ListThreadsQuery,
} from "../schemas/thread.schema";
import type { CreateReplyInput, UpdateReplyInput } from "../schemas/reply.schema";

// ─── Thread state machine ─────────────────────────────────────────────────────

import {
  canTransition as canTransitionPure,
} from "../lib/thread-state";

function assertTransitionAllowed(from: ThreadState, to: ThreadState): void {
  if (!canTransitionPure(from, to)) {
    throw new AppError(
      422,
      ErrorCode.INVALID_STATE_TRANSITION,
      `Cannot transition thread from ${from} to ${to}`
    );
  }
}

// ─── Threads ──────────────────────────────────────────────────────────────────

export async function createThread(
  organizationId: string,
  authorId: string,
  input: CreateThreadInput
): Promise<ThreadWithIncludes> {
  // ── Tenant isolation: verify all referenced IDs belong to this org ──

  // 1. Section must belong to this organization
  const section = await sectionRepository.findById(input.sectionId, organizationId);
  if (!section) {
    throw new AppError(
      400,
      ErrorCode.TENANT_VIOLATION,
      "Section not found in your organization"
    );
  }

  // 2. Subsection must belong to the specified section (and thus the org)
  if (input.subsectionId) {
    const subsection = await sectionRepository.findSubsectionById(
      input.subsectionId,
      input.sectionId
    );
    if (!subsection) {
      throw new AppError(
        400,
        ErrorCode.TENANT_VIOLATION,
        "Subsection not found in the specified section"
      );
    }
  }

  // 3. All tag IDs must belong to this organization
  if (input.tagIds && input.tagIds.length > 0) {
    for (const tagId of input.tagIds) {
      const tag = await tagRepository.findById(tagId, organizationId);
      if (!tag) {
        throw new AppError(
          400,
          ErrorCode.TENANT_VIOLATION,
          `Tag '${tagId}' not found in your organization`
        );
      }
    }
  }

  const thread = await threadRepository.create({
    ...input,
    organizationId,
    authorId,
  });

  await auditRepository.create({
    organizationId,
    actorId: authorId,
    eventType: "thread.created",
    resourceType: "Thread",
    resourceId: thread.id,
    details: { title: thread.title, sectionId: thread.sectionId },
  });

  void analyticsService.recordEvent({
    organizationId,
    userId: authorId,
    eventType: EVENT.POST_CREATED,
    resourceType: "Thread",
    resourceId: thread.id,
  });

  return thread;
}

export async function listThreads(
  organizationId: string,
  query: ListThreadsQuery
): Promise<{ data: ThreadWithIncludes[]; total: number }> {
  const { tag, page, pageSize, ...filters } = query;
  return threadRepository.findMany({
    organizationId,
    tagSlug: tag,
    page,
    pageSize,
    ...filters,
  });
}

export async function getThread(
  threadId: string,
  organizationId: string,
  viewerId?: string
): Promise<ThreadWithIncludes> {
  const thread = await threadRepository.findById(threadId, organizationId);
  if (!thread) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Thread not found");
  }

  // Record view event fire-and-forget; internal calls without viewerId are skipped
  if (viewerId) {
    void analyticsService.recordEvent({
      organizationId,
      userId: viewerId,
      eventType: EVENT.THREAD_VIEW,
      resourceType: "Thread",
      resourceId: threadId,
    });
  }

  return thread;
}

export async function updateThread(
  threadId: string,
  organizationId: string,
  actorId: string,
  actorRole: string,
  input: UpdateThreadInput
): Promise<Thread> {
  const thread = await getThread(threadId, organizationId);

  // Object-level authorization: only the author, moderators, or admins may edit
  if (
    thread.authorId !== actorId &&
    actorRole !== "MODERATOR" &&
    actorRole !== "ADMINISTRATOR"
  ) {
    throw new AppError(403, ErrorCode.FORBIDDEN, "You can only edit your own threads");
  }

  if (thread.state === ThreadState.ARCHIVED) {
    throw new AppError(
      422,
      ErrorCode.THREAD_ARCHIVED,
      "Archived thread cannot be edited"
    );
  }

  const updated = await threadRepository.update(threadId, input);

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "thread.updated",
    resourceType: "Thread",
    resourceId: threadId,
    details: input,
  });

  return updated;
}

export async function transitionThreadState(
  threadId: string,
  organizationId: string,
  actorId: string,
  input: ThreadStateInput
): Promise<Thread> {
  const thread = await getThread(threadId, organizationId);
  assertTransitionAllowed(thread.state, input.toState);

  const updated = await threadRepository.update(threadId, { state: input.toState });

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "thread.state_transitioned",
    resourceType: "Thread",
    resourceId: threadId,
    details: { from: thread.state, to: input.toState },
  });

  return updated;
}

export async function pinThread(
  threadId: string,
  organizationId: string,
  actorId: string
): Promise<Thread> {
  const thread = await getThread(threadId, organizationId);

  if (thread.isPinned) {
    throw new AppError(409, ErrorCode.CONFLICT, "Thread is already pinned");
  }

  const maxPinned = await getConfigValue(organizationId, CONFIG_KEYS.MAX_PINNED_PER_SECTION);

  // Use serializable transaction to prevent race condition on pin limit.
  // Without this, two concurrent pin requests could both read count=2 (max=3)
  // and both succeed, resulting in 4 pinned threads.
  const updated = await prisma.$transaction(async (tx) => {
    const pinnedCount = await tx.thread.count({
      where: {
        organizationId,
        sectionId: thread.sectionId,
        isPinned: true,
        deletedAt: null,
      },
    });
    if (pinnedCount >= maxPinned) {
      throw new AppError(
        409,
        ErrorCode.PIN_LIMIT_REACHED,
        `Section already has the maximum of ${maxPinned} pinned threads`
      );
    }
    return tx.thread.update({
      where: { id: threadId },
      data: { isPinned: true },
    });
  }, { isolationLevel: "Serializable" });

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "thread.pinned",
    resourceType: "Thread",
    resourceId: threadId,
  });

  return updated;
}

export async function unpinThread(
  threadId: string,
  organizationId: string,
  actorId: string
): Promise<Thread> {
  const thread = await getThread(threadId, organizationId);

  if (!thread.isPinned) {
    throw new AppError(409, ErrorCode.CONFLICT, "Thread is not pinned");
  }

  const updated = await threadRepository.update(threadId, { isPinned: false });

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "thread.unpinned",
    resourceType: "Thread",
    resourceId: threadId,
  });

  return updated;
}

export async function featureThread(
  threadId: string,
  organizationId: string,
  actorId: string
): Promise<Thread> {
  const thread = await getThread(threadId, organizationId);

  if (thread.isFeatured) {
    throw new AppError(409, ErrorCode.CONFLICT, "Thread is already featured");
  }

  const updated = await threadRepository.update(threadId, { isFeatured: true });

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "thread.featured",
    resourceType: "Thread",
    resourceId: threadId,
  });

  return updated;
}

export async function unfeatureThread(
  threadId: string,
  organizationId: string,
  actorId: string
): Promise<Thread> {
  const thread = await getThread(threadId, organizationId);

  if (!thread.isFeatured) {
    throw new AppError(409, ErrorCode.CONFLICT, "Thread is not featured");
  }

  const updated = await threadRepository.update(threadId, { isFeatured: false });

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "thread.unfeatured",
    resourceType: "Thread",
    resourceId: threadId,
  });

  return updated;
}

export async function deleteThread(
  threadId: string,
  organizationId: string,
  actorId: string,
  actorRole: string
): Promise<void> {
  const thread = await getThread(threadId, organizationId);

  // Object-level authorization: only the author, moderators, or admins may delete
  if (
    thread.authorId !== actorId &&
    actorRole !== "MODERATOR" &&
    actorRole !== "ADMINISTRATOR"
  ) {
    throw new AppError(403, ErrorCode.FORBIDDEN, "You can only delete your own threads");
  }

  const retentionDays = await getConfigValue(organizationId, CONFIG_KEYS.RECYCLE_BIN_RETENTION_DAYS);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + retentionDays * 86_400_000
  );

  await threadRepository.softDelete(threadId, now);
  await recycleRepository.create({
    organizationId,
    itemType: "THREAD",
    threadId: thread.id,
    deletedById: actorId,
    deletedAt: now,
    expiresAt,
  });

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "thread.deleted",
    resourceType: "Thread",
    resourceId: threadId,
  });
}

// ─── Thread Reporting ────────────────────────────────────────────────────────

const REPORT_DEDUP_WINDOW_MS = 3_600_000; // 1 hour

export async function reportThread(
  threadId: string,
  organizationId: string,
  reporterId: string,
  reason?: string
): Promise<void> {
  // Verify thread exists
  await getThread(threadId, organizationId);

  // Duplicate check: same user, same thread, within dedup window
  const windowStart = new Date(Date.now() - REPORT_DEDUP_WINDOW_MS);
  const existing = await prisma.auditLog.findFirst({
    where: {
      organizationId,
      actorId: reporterId,
      eventType: "thread.reported",
      resourceType: "Thread",
      resourceId: threadId,
      createdAt: { gte: windowStart },
    },
  });
  if (existing) {
    throw new AppError(
      409,
      ErrorCode.DUPLICATE_REPORT,
      "You have already reported this thread recently"
    );
  }

  // Record the report as an audit event — this is what the risk engine scans
  await auditRepository.create({
    organizationId,
    actorId: reporterId,
    eventType: "thread.reported",
    resourceType: "Thread",
    resourceId: threadId,
    details: reason ? { reason } : undefined,
  });
}

// ─── Replies ──────────────────────────────────────────────────────────────────

export async function createReply(
  organizationId: string,
  authorId: string,
  threadId: string,
  input: CreateReplyInput
): Promise<ReplyWithAuthor> {
  const thread = await getThread(threadId, organizationId);

  if (thread.state === ThreadState.LOCKED) {
    throw new AppError(
      422,
      ErrorCode.THREAD_LOCKED,
      "Thread is locked and cannot accept new replies"
    );
  }
  if (thread.state === ThreadState.ARCHIVED) {
    throw new AppError(
      422,
      ErrorCode.THREAD_ARCHIVED,
      "Thread is archived and cannot accept new replies"
    );
  }

  let depth = 1;
  const parentReplyId = input.parentReplyId ?? undefined;

  if (parentReplyId) {
    const parent = await replyRepository.findParent(parentReplyId, threadId);
    if (!parent) {
      throw new AppError(404, ErrorCode.NOT_FOUND, "Parent reply not found");
    }
    depth = parent.depth + 1;
    const maxDepth = await getConfigValue(organizationId, CONFIG_KEYS.MAX_REPLY_DEPTH);
    if (depth > maxDepth) {
      throw new AppError(
        422,
        ErrorCode.REPLY_DEPTH_EXCEEDED,
        `Reply nesting exceeds the maximum depth of ${maxDepth}`
      );
    }
  }

  const reply = await replyRepository.create({
    organizationId,
    threadId,
    authorId,
    parentReplyId,
    depth,
    body: input.body,
  });

  await auditRepository.create({
    organizationId,
    actorId: authorId,
    eventType: "reply.created",
    resourceType: "Reply",
    resourceId: reply.id,
    details: { threadId, depth },
  });

  void notifyNewReply(threadId, organizationId, authorId, input.body);

  void analyticsService.recordEvent({
    organizationId,
    userId: authorId,
    eventType: EVENT.POST_CREATED,
    resourceType: "Reply",
    resourceId: reply.id,
  });
  void analyticsService.recordEvent({
    organizationId,
    userId: authorId,
    eventType: EVENT.ENGAGEMENT,
    resourceType: "Thread",
    resourceId: threadId,
  });

  return reply;
}

export async function listReplies(
  threadId: string,
  organizationId: string
): Promise<ReplyWithAuthor[]> {
  // Verify thread exists and belongs to org
  await getThread(threadId, organizationId);
  return replyRepository.findByThread(threadId, organizationId);
}

export async function updateReply(
  replyId: string,
  organizationId: string,
  actorId: string,
  actorRole: string,
  input: UpdateReplyInput
): Promise<ReplyWithAuthor> {
  const reply = await replyRepository.findById(replyId, organizationId);
  if (!reply) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Reply not found");
  }

  // Object-level authorization: only the author, moderators, or admins may edit
  if (
    reply.authorId !== actorId &&
    actorRole !== "MODERATOR" &&
    actorRole !== "ADMINISTRATOR"
  ) {
    throw new AppError(403, ErrorCode.FORBIDDEN, "You can only edit your own replies");
  }

  // thread.organizationId already enforced by findById scoping
  if (reply.thread.state === "ARCHIVED") {
    throw new AppError(
      422,
      ErrorCode.THREAD_ARCHIVED,
      "Cannot edit a reply in an archived thread"
    );
  }

  await replyRepository.update(replyId, input.body);

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "reply.updated",
    resourceType: "Reply",
    resourceId: replyId,
  });

  const updated = await replyRepository.findByIdWithAuthor(replyId, organizationId);
  if (!updated) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Reply not found after update");
  }
  return updated;
}

export async function deleteReply(
  replyId: string,
  organizationId: string,
  actorId: string,
  actorRole: string
): Promise<void> {
  const reply = await replyRepository.findById(replyId, organizationId);
  if (!reply) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Reply not found");
  }

  // Object-level authorization: only the author, moderators, or admins may delete
  if (
    reply.authorId !== actorId &&
    actorRole !== "MODERATOR" &&
    actorRole !== "ADMINISTRATOR"
  ) {
    throw new AppError(403, ErrorCode.FORBIDDEN, "You can only delete your own replies");
  }

  const retentionDays = await getConfigValue(organizationId, CONFIG_KEYS.RECYCLE_BIN_RETENTION_DAYS);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + retentionDays * 86_400_000
  );

  await replyRepository.softDelete(replyId, now);
  await recycleRepository.create({
    organizationId,
    itemType: "REPLY",
    replyId: reply.id,
    deletedById: actorId,
    deletedAt: now,
    expiresAt,
  });

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "reply.deleted",
    resourceType: "Reply",
    resourceId: replyId,
  });
}
