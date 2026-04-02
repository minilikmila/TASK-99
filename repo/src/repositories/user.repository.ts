import { User, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";

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

export const userRepository = {
  findByOrgAndUsername(
    organizationId: string,
    username: string
  ): Promise<User | null> {
    return prisma.user.findUnique({
      where: { organizationId_username: { organizationId, username } },
    });
  },

  findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  findByIdInOrg(id: string, organizationId: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { id, organizationId } });
  },

  create(data: CreateUserInput): Promise<User> {
    return prisma.user.create({ data });
  },

  update(
    id: string,
    data: Partial<Pick<User, "isBanned" | "muteUntil" | "role" | "passwordHash">>
  ): Promise<User> {
    return prisma.user.update({ where: { id }, data });
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
    return prisma.loginAttempt.create({ data }).then(() => undefined);
  },
};
