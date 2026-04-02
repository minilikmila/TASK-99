import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export interface AuditEventInput {
  organizationId: string;
  actorId?: string;
  eventType: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Append-only audit log writer.
 * No updates or deletes are ever performed on AuditLog records.
 */
export async function writeAuditLog(event: AuditEventInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: event.organizationId,
      actorId: event.actorId,
      eventType: event.eventType,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      details: (event.details ?? {}) as Prisma.InputJsonValue,
      ipAddress: event.ipAddress,
    },
  });
}

export async function queryAuditLogs(params: {
  organizationId: string;
  actorId?: string;
  eventType?: string;
  page: number;
  pageSize: number;
}) {
  const { organizationId, actorId, eventType, page, pageSize } = params;
  const skip = (page - 1) * pageSize;

  const where = {
    organizationId,
    ...(actorId && { actorId }),
    ...(eventType && { eventType }),
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
}
