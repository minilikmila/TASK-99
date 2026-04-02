import { Tag } from "@prisma/client";
import { prisma } from "../lib/prisma";

export interface CreateTagInput {
  organizationId: string;
  name: string;
  slug: string;
}

export const tagRepository = {
  findAll(organizationId: string): Promise<Tag[]> {
    return prisma.tag.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { name: "asc" },
    });
  },

  findById(id: string, organizationId: string): Promise<Tag | null> {
    return prisma.tag.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
  },

  findBySlug(slug: string, organizationId: string): Promise<Tag | null> {
    return prisma.tag.findFirst({
      where: { slug, organizationId, deletedAt: null },
    });
  },

  create(data: CreateTagInput): Promise<Tag> {
    return prisma.tag.create({ data });
  },

  update(
    id: string,
    data: Partial<Pick<Tag, "name" | "slug">>
  ): Promise<Tag> {
    return prisma.tag.update({ where: { id }, data });
  },

  softDelete(id: string): Promise<Tag> {
    return prisma.tag.update({ where: { id }, data: { deletedAt: new Date() } });
  },
};
