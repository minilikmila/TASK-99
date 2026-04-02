import { ThreadState, Thread } from "@prisma/client";
import { threadRepository, ThreadWithIncludes } from "../repositories/thread.repository";
import { replyRepository, ReplyWithAuthor } from "../repositories/reply.repository";
import { recycleRepository } from "../repositories/recycle.repository";
import { auditRepository } from "../repositories/audit.repository";
import { notifyNewReply } from "./notification.service";
import { analyticsService, EVENT } from "./analytics.service";
import { config } from "../config";
import { AppError } from "../middleware/errorHandler";
import { ErrorCode } from "../types";
import type {
  CreateThreadInput,
  UpdateThreadInput,
  ThreadStateInput,
  ListThreadsQuery,
} from "../schemas/thread.schema";
import type { CreateReplyInput, UpdateReplyInput } from "../schemas/reply.schema";

// ─── Thread state machine ─────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Partial<Record<ThreadState, ThreadState[]>> = {
  ACTIVE: [ThreadState.LOCKED, ThreadState.ARCHIVED],
  LOCKED: [ThreadState.ARCHIVED],
  ARCHIVED: [], // irreversible
};

function assertTransitionAllowed(from: ThreadState, to: ThreadState): void {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
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
  input: UpdateThreadInput
): Promise<Thread> {
  const thread = await getThread(threadId, organizationId);

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

  const pinnedCount = await threadRepository.countPinned(
    organizationId,
    thread.sectionId
  );
  if (pinnedCount >= config.forum.maxPinnedPerSection) {
    throw new AppError(
      409,
      ErrorCode.PIN_LIMIT_REACHED,
      `Section already has the maximum of ${config.forum.maxPinnedPerSection} pinned threads`
    );
  }

  const updated = await threadRepository.update(threadId, { isPinned: true });

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

export async function deleteThread(
  threadId: string,
  organizationId: string,
  actorId: string
): Promise<void> {
  const thread = await getThread(threadId, organizationId);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + config.forum.recycleBinRetentionDays * 86_400_000
  );

  await threadRepository.softDelete(threadId, now);
  await recycleRepository.create({
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
    if (depth > config.forum.maxReplyDepth) {
      throw new AppError(
        422,
        ErrorCode.REPLY_DEPTH_EXCEEDED,
        `Reply nesting exceeds the maximum depth of ${config.forum.maxReplyDepth}`
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
  input: UpdateReplyInput
): Promise<ReplyWithAuthor> {
  const reply = await replyRepository.findById(replyId, organizationId);
  if (!reply) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Reply not found");
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
  actorId: string
): Promise<void> {
  const reply = await replyRepository.findById(replyId, organizationId);
  if (!reply) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Reply not found");
  }

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + config.forum.recycleBinRetentionDays * 86_400_000
  );

  await replyRepository.softDelete(replyId, now);
  await recycleRepository.create({
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
