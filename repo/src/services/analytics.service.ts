import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

// ─── Event type constants ─────────────────────────────────────────────────────

export const EVENT = {
  THREAD_VIEW: "thread_view",
  POST_CREATED: "post_created",
  ENGAGEMENT: "engagement",
  USER_REGISTERED: "user_registered",
} as const;

// ─── Input / Output types ─────────────────────────────────────────────────────

export interface EventLogInput {
  organizationId: string;
  userId?: string;
  eventType: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export interface FunnelMetrics {
  view: number;
  registration: number;
  post: number;
  engagement: number;
}

export interface DailyCount {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface TopThread {
  threadId: string;
  views: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const analyticsService = {
  // ── Event recording ────────────────────────────────────────────────────────

  async recordEvent(input: EventLogInput): Promise<void> {
    await prisma.eventLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        eventType: input.eventType,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  },

  // ── Funnel: view → registration → post → engagement ───────────────────────

  async getFunnelMetrics(
    organizationId: string,
    from: Date,
    to: Date
  ): Promise<FunnelMetrics> {
    const where = {
      organizationId,
      createdAt: { gte: from, lte: to },
    };

    const [views, registrations, posts, engagements] = await Promise.all([
      prisma.eventLog.count({ where: { ...where, eventType: EVENT.THREAD_VIEW } }),
      prisma.eventLog.count({ where: { ...where, eventType: EVENT.USER_REGISTERED } }),
      prisma.eventLog.count({ where: { ...where, eventType: EVENT.POST_CREATED } }),
      prisma.eventLog.count({ where: { ...where, eventType: EVENT.ENGAGEMENT } }),
    ]);

    return { view: views, registration: registrations, post: posts, engagement: engagements };
  },

  // ── Daily breakdown for a given event type ─────────────────────────────────
  // Returns one count per calendar day within the range.

  async getDailyBreakdown(
    organizationId: string,
    eventType: string,
    from: Date,
    to: Date
  ): Promise<DailyCount[]> {
    // Use Prisma raw groupBy — PostgreSQL DATE() truncation
    const rows = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT
        DATE_TRUNC('day', "createdAt") AS day,
        COUNT(*)::bigint               AS count
      FROM "EventLog"
      WHERE "organizationId" = ${organizationId}
        AND "eventType"       = ${eventType}
        AND "createdAt"      >= ${from}
        AND "createdAt"      <= ${to}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY day ASC
    `;

    return rows.map((r) => ({
      date: r.day.toISOString().slice(0, 10),
      count: Number(r.count),
    }));
  },

  // ── Top threads by view count ──────────────────────────────────────────────

  async getTopThreads(
    organizationId: string,
    from: Date,
    to: Date,
    limit = 10
  ): Promise<TopThread[]> {
    const rows = await prisma.$queryRaw<{ resourceId: string; count: bigint }[]>`
      SELECT
        "resourceId",
        COUNT(*)::bigint AS count
      FROM "EventLog"
      WHERE "organizationId" = ${organizationId}
        AND "eventType"       = ${EVENT.THREAD_VIEW}
        AND "resourceType"    = 'Thread'
        AND "resourceId"     IS NOT NULL
        AND "createdAt"      >= ${from}
        AND "createdAt"      <= ${to}
      GROUP BY "resourceId"
      ORDER BY count DESC
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      threadId: r.resourceId,
      views: Number(r.count),
    }));
  },

  // ── Distinct active users in a time window ────────────────────────────────

  async getActiveUserCount(
    organizationId: string,
    from: Date,
    to: Date
  ): Promise<number> {
    const result = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT "userId")::bigint AS count
      FROM "EventLog"
      WHERE "organizationId" = ${organizationId}
        AND "userId"         IS NOT NULL
        AND "createdAt"      >= ${from}
        AND "createdAt"      <= ${to}
    `;
    return Number(result[0]?.count ?? 0);
  },

  // ── Summary: all key metrics in one call ──────────────────────────────────

  async getSummary(
    organizationId: string,
    from: Date,
    to: Date
  ): Promise<{
    funnel: FunnelMetrics;
    activeUsers: number;
    topThreads: TopThread[];
  }> {
    const [funnel, activeUsers, topThreads] = await Promise.all([
      analyticsService.getFunnelMetrics(organizationId, from, to),
      analyticsService.getActiveUserCount(organizationId, from, to),
      analyticsService.getTopThreads(organizationId, from, to, 5),
    ]);
    return { funnel, activeUsers, topThreads };
  },
};
