import { FeatureFlag } from "@prisma/client";
import { prisma } from "../lib/prisma";

export const featureFlagRepository = {
  findAll(organizationId: string): Promise<FeatureFlag[]> {
    return prisma.featureFlag.findMany({
      where: { organizationId },
      orderBy: { key: "asc" },
    });
  },

  findByKey(organizationId: string, key: string): Promise<FeatureFlag | null> {
    return prisma.featureFlag.findUnique({
      where: { organizationId_key: { organizationId, key } },
    });
  },

  create(data: {
    organizationId: string;
    key: string;
    value: boolean;
    description?: string;
  }): Promise<FeatureFlag> {
    return prisma.featureFlag.create({ data });
  },

  update(
    organizationId: string,
    key: string,
    data: { value?: boolean; description?: string }
  ): Promise<FeatureFlag> {
    return prisma.featureFlag.update({
      where: { organizationId_key: { organizationId, key } },
      data,
    });
  },

  delete(organizationId: string, key: string): Promise<FeatureFlag> {
    return prisma.featureFlag.delete({
      where: { organizationId_key: { organizationId, key } },
    });
  },

  /**
   * Efficiently check if a single flag is enabled. Returns false when the flag
   * doesn't exist rather than throwing — callers treat absence as disabled.
   */
  async isEnabled(organizationId: string, key: string): Promise<boolean> {
    const flag = await prisma.featureFlag.findUnique({
      where: { organizationId_key: { organizationId, key } },
      select: { value: true },
    });
    return flag?.value ?? false;
  },
};
