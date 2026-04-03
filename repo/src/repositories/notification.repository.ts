import { Notification, NotificationStatus, NotificationSubscription } from "@prisma/client";
import { prisma } from "../lib/prisma";

export interface CreateNotificationInput {
  organizationId: string;
  userId: string;
  category: string;
  title: string;
  body: string;
  scheduledAt: Date;
}

export const notificationRepository = {
  async create(data: CreateNotificationInput): Promise<Notification> {
    return prisma.notification.create({ data });
  },

  async findByUser(
    userId: string,
    organizationId: string,
    limit = 50
  ): Promise<Notification[]> {
    return prisma.notification.findMany({
      where: { userId, organizationId },
      orderBy: { scheduledAt: "desc" },
      take: limit,
    });
  },

  async findDueForDispatch(now: Date, limit = 200): Promise<Notification[]> {
    return prisma.notification.findMany({
      where: {
        status: NotificationStatus.PENDING,
        scheduledAt: { lte: now },
      },
      take: limit,
    });
  },

  async findFailedForRetry(
    organizationId: string,
    maxRetries: number,
    windowStart: Date,
    now: Date,
    limit = 200
  ): Promise<Notification[]> {
    return prisma.notification.findMany({
      where: {
        organizationId,
        status: NotificationStatus.FAILED,
        retryCount: { lt: maxRetries },
        createdAt: { gte: windowStart },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      take: limit,
    });
  },

  async markDelivered(id: string, deliveredAt: Date): Promise<void> {
    await prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.DELIVERED, deliveredAt },
    });
  },

  async markOpened(id: string, userId: string, openedAt: Date): Promise<void> {
    await prisma.notification.updateMany({
      where: { id, userId },
      data: { status: NotificationStatus.OPENED, openedAt },
    });
  },

  async markFailed(
    id: string,
    retryCount: number,
    nextRetryAt: Date | null
  ): Promise<void> {
    await prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.FAILED, retryCount, nextRetryAt },
    });
  },

  async scheduleRetry(
    id: string,
    retryCount: number,
    nextRetryAt: Date
  ): Promise<void> {
    await prisma.notification.update({
      where: { id },
      data: {
        status: NotificationStatus.PENDING,
        scheduledAt: nextRetryAt,
        nextRetryAt,
        retryCount,
      },
    });
  },

  async getSubscription(
    userId: string,
    category: string
  ): Promise<NotificationSubscription | null> {
    return prisma.notificationSubscription.findUnique({
      where: { userId_category: { userId, category } },
    });
  },

  async upsertSubscription(
    userId: string,
    organizationId: string,
    category: string,
    isOptIn: boolean
  ): Promise<void> {
    await prisma.notificationSubscription.upsert({
      where: { userId_category: { userId, category } },
      create: { userId, organizationId, category, isOptIn },
      update: { isOptIn },
    });
  },

  async getSubscriptionsForUser(
    userId: string
  ): Promise<NotificationSubscription[]> {
    return prisma.notificationSubscription.findMany({ where: { userId } });
  },

  async findOrgUserIds(organizationId: string): Promise<string[]> {
    const users = await prisma.user.findMany({
      where: { organizationId, isBanned: false },
      select: { id: true },
    });
    return users.map((u) => u.id);
  },

  async findThreadAuthorId(
    threadId: string,
    organizationId: string
  ): Promise<string | null> {
    const thread = await prisma.thread.findFirst({
      where: { id: threadId, organizationId, deletedAt: null },
      select: { authorId: true },
    });
    return thread?.authorId ?? null;
  },
};
