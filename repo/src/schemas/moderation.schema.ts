import { z } from "zod";
import { RiskFlagStatus, Role } from "@prisma/client";
import { config } from "../config";

export const muteSchema = z.object({
  durationHours: z
    .number({ required_error: "durationHours is required" })
    .int()
    .min(
      config.forum.muteDurationMinHours,
      `Minimum mute duration is ${config.forum.muteDurationMinHours} hours`
    )
    .max(
      config.forum.muteDurationMaxDays * 24,
      `Maximum mute duration is ${config.forum.muteDurationMaxDays * 24} hours`
    ),
  reason: z.string().max(500).optional(),
});

export const bulkContentSchema = z.object({
  action: z.enum(["archive_threads", "lock_threads", "delete_threads"]),
  threadIds: z
    .array(z.string().min(1))
    .min(1, "At least one thread required")
    .max(
      config.forum.bulkActionMaxItems,
      `Maximum ${config.forum.bulkActionMaxItems} items per request`
    ),
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

export type MuteInput = z.infer<typeof muteSchema>;
export type BulkContentInput = z.infer<typeof bulkContentSchema>;
export type UpdateRiskFlagInput = z.infer<typeof updateRiskFlagSchema>;
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
