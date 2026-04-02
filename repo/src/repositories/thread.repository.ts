import { Thread, ThreadState, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export interface CreateThreadInput {
  organizationId: string;
  sectionId: string;
  subsectionId?: string;
  authorId: string;
  title: string;
  body: string;
  isFeatured?: boolean;
  tagIds?: string[];
}

export interface QueryThreadsInput {
  organizationId: string;
  sectionId?: string;
  subsectionId?: string;
  state?: ThreadState;
  isPinned?: boolean;
  isFeatured?: boolean;
  tagSlug?: string;
  page: number;
  pageSize: number;
}

// Include shape used consistently across the app
const threadInclude = {
  author: { select: { id: true, username: true, role: true } },
  tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
} satisfies Prisma.ThreadInclude;

export type ThreadWithIncludes = Prisma.ThreadGetPayload<{
  include: typeof threadInclude;
}>;

export const threadRepository = {
  async create(data: CreateThreadInput): Promise<ThreadWithIncludes> {
    const { tagIds = [], ...rest } = data;
    return prisma.thread.create({
      data: {
        ...rest,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
      include: threadInclude,
    });
  },

  async findMany(
    input: QueryThreadsInput
  ): Promise<{ data: ThreadWithIncludes[]; total: number }> {
    const { organizationId, page, pageSize, tagSlug, ...filters } = input;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ThreadWhereInput = {
      organizationId,
      deletedAt: null,
      ...(filters.sectionId && { sectionId: filters.sectionId }),
      ...(filters.subsectionId && { subsectionId: filters.subsectionId }),
      ...(filters.state && { state: filters.state }),
      ...(filters.isPinned !== undefined && { isPinned: filters.isPinned }),
      ...(filters.isFeatured !== undefined && { isFeatured: filters.isFeatured }),
      ...(tagSlug && { tags: { some: { tag: { slug: tagSlug } } } }),
    };

    const [data, total] = await prisma.$transaction([
      prisma.thread.findMany({
        where,
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        skip,
        take: pageSize,
        include: threadInclude,
      }),
      prisma.thread.count({ where }),
    ]);

    return { data, total };
  },

  findById(
    id: string,
    organizationId: string
  ): Promise<ThreadWithIncludes | null> {
    return prisma.thread.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: threadInclude,
    });
  },

  update(
    id: string,
    data: Partial<Pick<Thread, "title" | "body" | "state" | "isPinned" | "isFeatured" | "deletedAt">>
  ): Promise<Thread> {
    return prisma.thread.update({ where: { id }, data });
  },

  countPinned(organizationId: string, sectionId: string): Promise<number> {
    return prisma.thread.count({
      where: { organizationId, sectionId, isPinned: true, deletedAt: null },
    });
  },

  softDelete(id: string, deletedAt: Date): Promise<Thread> {
    return prisma.thread.update({ where: { id }, data: { deletedAt } });
  },
};
