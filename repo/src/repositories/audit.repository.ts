import { AuditLog, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export interface CreateAuditInput {
  organizationId: string;
  actorId?: string;
  eventType: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export interface QueryAuditInput {
  organizationId: string;
  actorId?: string;
  eventType?: string;
  resourceType?: string;
  fromDate?: Date;
  toDate?: Date;
  page: number;
  pageSize: number;
}

/**
 * Audit log repository — append-only.
 * This module deliberately exposes NO update or delete operations.
 */
export const auditRepository = {
  create(data: CreateAuditInput): Promise<AuditLog> {
    return prisma.auditLog.create({
      data: {
        organizationId: data.organizationId,
        actorId: data.actorId,
        eventType: data.eventType,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        details: (data.details ?? {}) as Prisma.InputJsonValue,
        ipAddress: data.ipAddress,
      },
    });
  },

  async query(
    input: QueryAuditInput
  ): Promise<{ data: AuditLog[]; total: number }> {
    const { organizationId, actorId, eventType, resourceType, fromDate, toDate, page, pageSize } =
      input;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AuditLogWhereInput = {
      organizationId,
      ...(actorId && { actorId }),
      ...(eventType && { eventType }),
      ...(resourceType && { resourceType }),
      ...((fromDate || toDate) && {
        createdAt: {
          ...(fromDate && { gte: fromDate }),
          ...(toDate && { lte: toDate }),
        },
      }),
    };

    const [data, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { data, total };
  },
};
