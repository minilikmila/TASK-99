import { Reply, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export interface CreateReplyInput {
  organizationId: string;
  threadId: string;
  authorId: string;
  parentReplyId?: string;
  depth: number;
  body: string;
}

const replyInclude = {
  author: { select: { id: true, username: true, role: true } },
} satisfies Prisma.ReplyInclude;

export type ReplyWithAuthor = Prisma.ReplyGetPayload<{
  include: typeof replyInclude;
}>;

export const replyRepository = {
  findByThread(
    threadId: string,
    organizationId: string
  ): Promise<ReplyWithAuthor[]> {
    return prisma.reply.findMany({
      where: { threadId, organizationId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: replyInclude,
    });
  },

  findById(id: string, organizationId: string): Promise<(Reply & { thread: { state: string; organizationId: string } }) | null> {
    return prisma.reply.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { thread: { select: { state: true, organizationId: true } } },
    }) as Promise<(Reply & { thread: { state: string; organizationId: string } }) | null>;
  },

  findByIdWithAuthor(
    id: string,
    organizationId: string
  ): Promise<ReplyWithAuthor | null> {
    return prisma.reply.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: replyInclude,
    });
  },

  findParent(
    parentReplyId: string,
    threadId: string
  ): Promise<Reply | null> {
    return prisma.reply.findFirst({
      where: { id: parentReplyId, threadId, deletedAt: null },
    });
  },

  create(data: CreateReplyInput): Promise<ReplyWithAuthor> {
    return prisma.reply.create({ data, include: replyInclude });
  },

  update(id: string, body: string): Promise<Reply> {
    return prisma.reply.update({ where: { id }, data: { body } });
  },

  softDelete(id: string, deletedAt: Date): Promise<Reply> {
    return prisma.reply.update({ where: { id }, data: { deletedAt } });
  },
};
