import { Tag } from "@prisma/client";
import { tagRepository } from "../repositories/tag.repository";
import { auditRepository } from "../repositories/audit.repository";
import { AppError } from "../middleware/errorHandler";
import { ErrorCode } from "../types";
import type { CreateTagInput, UpdateTagInput } from "../schemas/tag.schema";

export async function listTags(organizationId: string): Promise<Tag[]> {
  return tagRepository.findAll(organizationId);
}

export async function createTag(
  organizationId: string,
  actorId: string,
  input: CreateTagInput
): Promise<Tag> {
  const existing = await tagRepository.findBySlug(input.slug, organizationId);
  if (existing) {
    throw new AppError(
      409,
      ErrorCode.CONFLICT,
      `Tag slug "${input.slug}" already exists in this organization`
    );
  }

  const tag = await tagRepository.create({ ...input, organizationId });

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "tag.created",
    resourceType: "Tag",
    resourceId: tag.id,
    details: { name: tag.name, slug: tag.slug },
  });

  return tag;
}

export async function updateTag(
  tagId: string,
  organizationId: string,
  actorId: string,
  input: UpdateTagInput
): Promise<Tag> {
  const existing = await tagRepository.findById(tagId, organizationId);
  if (!existing) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Tag not found");
  }

  // Slug uniqueness check when changing slug
  if (input.slug && input.slug !== existing.slug) {
    const slugConflict = await tagRepository.findBySlug(
      input.slug,
      organizationId
    );
    if (slugConflict) {
      throw new AppError(
        409,
        ErrorCode.CONFLICT,
        `Tag slug "${input.slug}" already exists in this organization`
      );
    }
  }

  const updated = await tagRepository.update(tagId, input);

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "tag.updated",
    resourceType: "Tag",
    resourceId: tagId,
    details: input,
  });

  return updated;
}

export async function deleteTag(
  tagId: string,
  organizationId: string,
  actorId: string
): Promise<void> {
  const existing = await tagRepository.findById(tagId, organizationId);
  if (!existing) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Tag not found");
  }

  await tagRepository.softDelete(tagId);

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "tag.deleted",
    resourceType: "Tag",
    resourceId: tagId,
  });
}
