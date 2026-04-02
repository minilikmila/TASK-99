import { Section, Subsection } from "@prisma/client";
import { prisma } from "../lib/prisma";

export interface CreateSectionInput {
  organizationId: string;
  name: string;
  description?: string;
}

export interface CreateSubsectionInput {
  sectionId: string;
  name: string;
}

export const sectionRepository = {
  findAll(organizationId: string): Promise<Section[]> {
    return prisma.section.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    });
  },

  findById(id: string, organizationId: string): Promise<Section | null> {
    return prisma.section.findFirst({ where: { id, organizationId } });
  },

  create(data: CreateSectionInput): Promise<Section> {
    return prisma.section.create({ data });
  },

  update(
    id: string,
    data: Partial<Pick<Section, "name" | "description">>
  ): Promise<Section> {
    return prisma.section.update({ where: { id }, data });
  },

  findSubsections(sectionId: string): Promise<Subsection[]> {
    return prisma.subsection.findMany({
      where: { sectionId },
      orderBy: { createdAt: "asc" },
    });
  },

  findSubsectionById(id: string, sectionId: string): Promise<Subsection | null> {
    return prisma.subsection.findFirst({ where: { id, sectionId } });
  },

  createSubsection(data: CreateSubsectionInput): Promise<Subsection> {
    return prisma.subsection.create({ data });
  },
};
