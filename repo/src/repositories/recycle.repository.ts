import { RecycleBinItem, RecycleBinItemType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export interface CreateRecycleItemInput {
  organizationId: string;
  itemType: RecycleBinItemType;
  threadId?: string;
  replyId?: string;
  deletedById: string;
  deletedAt: Date;
  expiresAt: Date;
}

const recycleBinInclude = {
  thread: {
    select: {
      id: true,
      title: true,
      state: true,
      isPinned: true,
      organizationId: true,
      sectionId: true,
    },
  },
  reply: {
    select: {
      id: true,
      body: true,
      threadId: true,
      depth: true,
      thread: { select: { organizationId: true } },
    },
  },
} satisfies Prisma.RecycleBinItemInclude;

export type RecycleBinItemWithContent = Prisma.RecycleBinItemGetPayload<{
  include: typeof recycleBinInclude;
}>;

export const recycleRepository = {
  findActiveByOrg(
    organizationId: string,
    now: Date
  ): Promise<RecycleBinItemWithContent[]> {
    return prisma.recycleBinItem.findMany({
      where: { organizationId, expiresAt: { gt: now } },
      include: recycleBinInclude,
      orderBy: { deletedAt: "desc" },
    });
  },

  findByIdInOrg(id: string, organizationId: string): Promise<RecycleBinItemWithContent | null> {
    return prisma.recycleBinItem.findFirst({
      where: { id, organizationId },
      include: recycleBinInclude,
    });
  },

  create(data: CreateRecycleItemInput): Promise<RecycleBinItem> {
    return prisma.recycleBinItem.create({ data });
  },

  delete(id: string): Promise<RecycleBinItem> {
    return prisma.recycleBinItem.delete({ where: { id } });
  },

  purgeExpired(now: Date): Promise<{ count: number }> {
    return prisma.recycleBinItem.deleteMany({ where: { expiresAt: { lt: now } } });
  },
};
