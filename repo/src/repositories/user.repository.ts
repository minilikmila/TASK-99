import { User, Role, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { maskIp } from "../lib/logger";
import { encryptField } from "../lib/encryption";

export interface CreateUserInput {
  organizationId: string;
  username: string;
  passwordHash: string;
  role?: Role;
}

export interface LoginAttemptInput {
  userId?: string;
  username: string;
  orgSlug: string;
  success: boolean;
  ipAddress?: string;
}

export interface UpdateUserInput {
  isBanned?: boolean;
  muteUntil?: Date | null;
  role?: Role;
  passwordHash?: string;
  tokenVersion?: number | { increment: number };
}

export const userRepository = {
  findByOrgAndUsername(
    organizationId: string,
    username: string
  ): Promise<User | null> {
    return prisma.user.findUnique({
      where: { organizationId_username: { organizationId, username } },
    });
  },

  findByIdInOrg(id: string, organizationId: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { id, organizationId } });
  },

  create(data: CreateUserInput): Promise<User> {
    return prisma.user.create({ data });
  },

  update(id: string, data: UpdateUserInput): Promise<User> {
    // Transform the tokenVersion increment syntax for Prisma
    const prismaData: Prisma.UserUpdateInput = {};

    if (data.isBanned !== undefined) prismaData.isBanned = data.isBanned;
    if (data.muteUntil !== undefined) prismaData.muteUntil = data.muteUntil;
    if (data.role !== undefined) prismaData.role = data.role;
    if (data.passwordHash !== undefined) prismaData.passwordHash = data.passwordHash;

    if (data.tokenVersion !== undefined) {
      if (typeof data.tokenVersion === "object" && "increment" in data.tokenVersion) {
        prismaData.tokenVersion = { increment: data.tokenVersion.increment };
      } else {
        prismaData.tokenVersion = data.tokenVersion;
      }
    }

    return prisma.user.update({ where: { id }, data: prismaData });
  },

  countRecentFailedAttempts(
    username: string,
    orgSlug: string,
    since: Date
  ): Promise<number> {
    return prisma.loginAttempt.count({
      where: { username, orgSlug, success: false, createdAt: { gte: since } },
    });
  },

  createLoginAttempt(data: LoginAttemptInput): Promise<void> {
    return prisma.loginAttempt.create({
      data: {
        ...data,
        ipAddress: data.ipAddress ? encryptField(maskIp(data.ipAddress)) : undefined,
      },
    }).then(() => undefined);
  },
};
