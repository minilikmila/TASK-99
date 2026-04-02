import { FeatureFlag } from "@prisma/client";
import { featureFlagRepository } from "../repositories/feature-flag.repository";
import { auditRepository } from "../repositories/audit.repository";
import { AppError } from "../middleware/errorHandler";
import { ErrorCode } from "../types";
import type {
  CreateFeatureFlagInput,
  UpdateFeatureFlagInput,
} from "../schemas/feature-flag.schema";

export async function listFeatureFlags(
  organizationId: string
): Promise<FeatureFlag[]> {
  return featureFlagRepository.findAll(organizationId);
}

export async function createFeatureFlag(
  organizationId: string,
  actorId: string,
  input: CreateFeatureFlagInput
): Promise<FeatureFlag> {
  const existing = await featureFlagRepository.findByKey(organizationId, input.key);
  if (existing) {
    throw new AppError(
      409,
      ErrorCode.CONFLICT,
      `Feature flag "${input.key}" already exists`
    );
  }

  const flag = await featureFlagRepository.create({
    organizationId,
    key: input.key,
    value: input.value,
    description: input.description,
  });

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "feature_flag.created",
    resourceType: "FeatureFlag",
    resourceId: flag.id,
    details: { key: flag.key, value: flag.value },
  });

  return flag;
}

export async function updateFeatureFlag(
  organizationId: string,
  key: string,
  actorId: string,
  input: UpdateFeatureFlagInput
): Promise<FeatureFlag> {
  const existing = await featureFlagRepository.findByKey(organizationId, key);
  if (!existing) {
    throw new AppError(404, ErrorCode.NOT_FOUND, `Feature flag "${key}" not found`);
  }

  const updated = await featureFlagRepository.update(organizationId, key, input);

  // Audit every toggle — this is a config change
  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "feature_flag.updated",
    resourceType: "FeatureFlag",
    resourceId: existing.id,
    details: {
      key,
      previousValue: existing.value,
      newValue: updated.value,
      description: input.description,
    },
  });

  return updated;
}

export async function deleteFeatureFlag(
  organizationId: string,
  key: string,
  actorId: string
): Promise<void> {
  const existing = await featureFlagRepository.findByKey(organizationId, key);
  if (!existing) {
    throw new AppError(404, ErrorCode.NOT_FOUND, `Feature flag "${key}" not found`);
  }

  await featureFlagRepository.delete(organizationId, key);

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "feature_flag.deleted",
    resourceType: "FeatureFlag",
    resourceId: existing.id,
    details: { key, lastValue: existing.value },
  });
}

export async function isFeatureEnabled(
  organizationId: string,
  key: string
): Promise<boolean> {
  return featureFlagRepository.isEnabled(organizationId, key);
}
