import { Organization } from "@prisma/client";
import { prisma } from "../lib/prisma";

export interface CreateOrganizationInput {
  name: string;
  slug: string;
}

export const organizationRepository = {
  findBySlug(slug: string): Promise<Organization | null> {
    return prisma.organization.findUnique({ where: { slug } });
  },

  findById(id: string): Promise<Organization | null> {
    return prisma.organization.findUnique({ where: { id } });
  },

  findAll(): Promise<Organization[]> {
    return prisma.organization.findMany({ orderBy: { createdAt: "asc" } });
  },

  create(data: CreateOrganizationInput): Promise<Organization> {
    return prisma.organization.create({ data });
  },

  update(
    id: string,
    data: Partial<Pick<Organization, "name" | "isActive">>
  ): Promise<Organization> {
    return prisma.organization.update({ where: { id }, data });
  },
};
