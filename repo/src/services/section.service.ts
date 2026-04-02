import { Section, Subsection } from "@prisma/client";
import { sectionRepository } from "../repositories/section.repository";
import { auditRepository } from "../repositories/audit.repository";
import { AppError } from "../middleware/errorHandler";
import { ErrorCode } from "../types";
import type {
  CreateSectionInput,
  UpdateSectionInput,
  CreateSubsectionInput,
} from "../schemas/section.schema";

export async function listSections(organizationId: string): Promise<Section[]> {
  return sectionRepository.findAll(organizationId);
}

export async function createSection(
  organizationId: string,
  actorId: string,
  input: CreateSectionInput
): Promise<Section> {
  const section = await sectionRepository.create({ ...input, organizationId });

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "section.created",
    resourceType: "Section",
    resourceId: section.id,
    details: { name: section.name },
  });

  return section;
}

export async function updateSection(
  sectionId: string,
  organizationId: string,
  actorId: string,
  input: UpdateSectionInput
): Promise<Section> {
  const existing = await sectionRepository.findById(sectionId, organizationId);
  if (!existing) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Section not found");
  }

  const updated = await sectionRepository.update(sectionId, input);

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "section.updated",
    resourceType: "Section",
    resourceId: sectionId,
    details: input,
  });

  return updated;
}

export async function listSubsections(sectionId: string): Promise<Subsection[]> {
  return sectionRepository.findSubsections(sectionId);
}

export async function createSubsection(
  sectionId: string,
  organizationId: string,
  actorId: string,
  input: CreateSubsectionInput
): Promise<Subsection> {
  const section = await sectionRepository.findById(sectionId, organizationId);
  if (!section) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Section not found");
  }

  const subsection = await sectionRepository.createSubsection({
    sectionId,
    name: input.name,
  });

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "subsection.created",
    resourceType: "Subsection",
    resourceId: subsection.id,
    details: { sectionId, name: subsection.name },
  });

  return subsection;
}
