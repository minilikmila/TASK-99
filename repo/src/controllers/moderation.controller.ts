import { Request, Response, NextFunction } from "express";
import { RiskFlagStatus } from "@prisma/client";
import { z } from "zod";
import {
  muteSchema,
  bulkContentSchema,
  updateRiskFlagSchema,
  auditLogQuerySchema,
  changeRoleSchema,
} from "../schemas/moderation.schema";
import * as moderationService from "../services/moderation.service";
import { auditRepository } from "../repositories/audit.repository";
import { buildPaginatedResponse } from "../lib/response";
import { getConfigValue, CONFIG_KEYS } from "../services/org-config.service";
import { AppError } from "../middleware/errorHandler";
import { ErrorCode } from "../types";

// ─── Ban / Unban ──────────────────────────────────────────────────────────────

export async function handleBan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await moderationService.banUser(
      req.params.userId,
      req.user!.organizationId,
      req.user!.id,
      req.socket.remoteAddress
    );
    res.json({ id: user.id, isBanned: user.isBanned });
  } catch (err) {
    next(err);
  }
}

export async function handleUnban(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await moderationService.unbanUser(
      req.params.userId,
      req.user!.organizationId,
      req.user!.id,
      req.socket.remoteAddress
    );
    res.json({ id: user.id, isBanned: user.isBanned });
  } catch (err) {
    next(err);
  }
}

// ─── Mute / Unmute ────────────────────────────────────────────────────────────

export async function handleMute(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = muteSchema.parse(req.body);

    // Enforce org-specific mute duration limits from DB
    const orgId = req.user!.organizationId;
    const minHours = await getConfigValue(orgId, CONFIG_KEYS.MUTE_DURATION_MIN_HOURS);
    const maxHours = await getConfigValue(orgId, CONFIG_KEYS.MUTE_DURATION_MAX_HOURS);
    if (input.durationHours < minHours) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, `Minimum mute duration is ${minHours} hours`);
    }
    if (input.durationHours > maxHours) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, `Maximum mute duration is ${maxHours} hours`);
    }

    const user = await moderationService.muteUser(
      req.params.userId,
      orgId,
      req.user!.id,
      input,
      req.socket.remoteAddress
    );
    res.json({ id: user.id, muteUntil: user.muteUntil });
  } catch (err) {
    next(err);
  }
}

export async function handleUnmute(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await moderationService.unmuteUser(
      req.params.userId,
      req.user!.organizationId,
      req.user!.id,
      req.socket.remoteAddress
    );
    res.json({ id: user.id, muteUntil: user.muteUntil });
  } catch (err) {
    next(err);
  }
}

// ─── Bulk Content ─────────────────────────────────────────────────────────────

export async function handleBulkContent(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = bulkContentSchema.parse(req.body);

    // Enforce org-specific bulk action limit from DB
    const orgId = req.user!.organizationId;
    const maxItems = await getConfigValue(orgId, CONFIG_KEYS.BULK_ACTION_MAX_ITEMS);
    if (input.threadIds.length > maxItems) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, `Maximum ${maxItems} items per request`);
    }

    const results = await moderationService.bulkContentAction(
      orgId,
      req.user!.id,
      input
    );
    res.json({ results });
  } catch (err) {
    next(err);
  }
}

// ─── Recycle Bin ──────────────────────────────────────────────────────────────

export async function handleRecycleBinList(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const items = await moderationService.listRecycleBin(req.user!.organizationId);
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
}

export async function handleRestore(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await moderationService.restoreItem(
      req.params.itemId,
      req.user!.organizationId,
      req.user!.id
    );
    res.json({ message: "Item restored successfully" });
  } catch (err) {
    next(err);
  }
}

export async function handlePurge(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await moderationService.purgeItem(
      req.params.itemId,
      req.user!.organizationId,
      req.user!.id
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ─── Risk Flags ───────────────────────────────────────────────────────────────

export async function handleListFlags(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const statusRaw = req.query.status as string | undefined;
    const status = statusRaw
      ? z.nativeEnum(RiskFlagStatus).parse(statusRaw)
      : undefined;

    const flags = await moderationService.listRiskFlags(
      req.user!.organizationId,
      status
    );
    res.json({ data: flags });
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateFlag(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = updateRiskFlagSchema.parse(req.body);
    const flag = await moderationService.updateRiskFlag(
      req.params.flagId,
      req.user!.organizationId,
      req.user!.id,
      input
    );
    res.json(flag);
  } catch (err) {
    next(err);
  }
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export async function handleListAuditLogs(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = auditLogQuerySchema.parse(req.query);
    const { data, total } = await auditRepository.query({
      organizationId: req.user!.organizationId,
      actorId: query.actorId,
      eventType: query.eventType,
      resourceType: query.resourceType,
      fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
      toDate: query.toDate ? new Date(query.toDate) : undefined,
      page: query.page,
      pageSize: query.pageSize,
    });
    res.json(buildPaginatedResponse(data, total, query.page, query.pageSize));
  } catch (err) {
    next(err);
  }
}

export async function handleChangeRole(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { role } = changeRoleSchema.parse(req.body);
    const updated = await moderationService.changeUserRole(
      req.params.userId,
      req.user!.organizationId,
      req.user!.id,
      role
    );
    res.json({ id: updated.id, role: updated.role });
  } catch (err) {
    next(err);
  }
}
