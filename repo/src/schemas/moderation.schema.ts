import { z } from "zod";
import { RiskFlagStatus, Role } from "@prisma/client";

// Mute duration is validated at the schema level with wide bounds.
// Per-org min/max limits are enforced at the service level from DB config.
export const muteSchema = z.object({
  durationHours: z
    .number({ required_error: "durationHours is required" })
    .int()
    .min(1, "Minimum mute duration is 1 hour")
    .max(8760, "Maximum mute duration is 8760 hours (365 days)"),
  reason: z.string().max(500).optional(),
});

// Bulk content action limits are validated at the schema level with a wide bound.
// Per-org max is enforced at the service level from DB config.
export const bulkContentSchema = z.object({
  action: z.enum(["archive_threads", "lock_threads", "delete_threads"]),
  threadIds: z
    .array(z.string().min(1))
    .min(1, "At least one thread required")
    .max(1000, "Maximum 1000 items per request"),
});

export const updateRiskFlagSchema = z.object({
  status: z.nativeEnum(RiskFlagStatus),
});

export const auditLogQuerySchema = z.object({
  actorId: z.string().optional(),
  eventType: z.string().optional(),
  resourceType: z.string().optional(),
  fromDate: z.string().datetime({ message: "fromDate must be ISO 8601 UTC" }).optional(),
  toDate: z.string().datetime({ message: "toDate must be ISO 8601 UTC" }).optional(),
  page: z
    .string()
    .optional()
    .transform((v) => Math.max(1, parseInt(v ?? "1", 10) || 1)),
  pageSize: z
    .string()
    .optional()
    .transform((v) => Math.min(100, Math.max(1, parseInt(v ?? "50", 10) || 50))),
});

export const changeRoleSchema = z.object({
  role: z.nativeEnum(Role),
});

export const reportThreadSchema = z.object({
  reason: z.string().max(1000).optional(),
});

export type MuteInput = z.infer<typeof muteSchema>;
export type BulkContentInput = z.infer<typeof bulkContentSchema>;
export type UpdateRiskFlagInput = z.infer<typeof updateRiskFlagSchema>;
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
export type ReportThreadInput = z.infer<typeof reportThreadSchema>;
