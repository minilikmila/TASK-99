import { Request, Response, NextFunction } from "express";
import {
  createThreadSchema,
  updateThreadSchema,
  threadStateSchema,
  listThreadsSchema,
} from "../schemas/thread.schema";
import { reportThreadSchema } from "../schemas/moderation.schema";
import * as forumService from "../services/forum.service";
import { buildPaginatedResponse } from "../lib/response";
import { AppError } from "../middleware/errorHandler";
import { ErrorCode } from "../types";

export async function handleCreate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user!;

    // Muted users cannot create threads
    if (user.muteUntil && user.muteUntil > new Date()) {
      throw new AppError(
        403,
        ErrorCode.USER_MUTED,
        `You are muted until ${user.muteUntil.toISOString()}`
      );
    }

    const input = createThreadSchema.parse(req.body);
    const thread = await forumService.createThread(
      user.organizationId,
      user.id,
      input
    );
    res.status(201).json(thread);
  } catch (err) {
    next(err);
  }
}

export async function handleList(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = listThreadsSchema.parse(req.query);
    const { data, total } = await forumService.listThreads(
      req.user!.organizationId,
      query
    );
    res.json(buildPaginatedResponse(data, total, query.page, query.pageSize));
  } catch (err) {
    next(err);
  }
}

export async function handleGet(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const thread = await forumService.getThread(
      req.params.threadId,
      req.user!.organizationId,
      req.user!.id
    );
    res.json(thread);
  } catch (err) {
    next(err);
  }
}

export async function handleUpdate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = updateThreadSchema.parse(req.body);
    const thread = await forumService.updateThread(
      req.params.threadId,
      req.user!.organizationId,
      req.user!.id,
      req.user!.role,
      input
    );
    res.json(thread);
  } catch (err) {
    next(err);
  }
}

export async function handleStateTransition(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = threadStateSchema.parse(req.body);
    const thread = await forumService.transitionThreadState(
      req.params.threadId,
      req.user!.organizationId,
      req.user!.id,
      input
    );
    res.json(thread);
  } catch (err) {
    next(err);
  }
}

export async function handlePin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const thread = await forumService.pinThread(
      req.params.threadId,
      req.user!.organizationId,
      req.user!.id
    );
    res.json(thread);
  } catch (err) {
    next(err);
  }
}

export async function handleUnpin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const thread = await forumService.unpinThread(
      req.params.threadId,
      req.user!.organizationId,
      req.user!.id
    );
    res.json(thread);
  } catch (err) {
    next(err);
  }
}

export async function handleDelete(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await forumService.deleteThread(
      req.params.threadId,
      req.user!.organizationId,
      req.user!.id,
      req.user!.role
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function handleFeature(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const thread = await forumService.featureThread(
      req.params.threadId,
      req.user!.organizationId,
      req.user!.id
    );
    res.json(thread);
  } catch (err) {
    next(err);
  }
}

export async function handleUnfeature(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const thread = await forumService.unfeatureThread(
      req.params.threadId,
      req.user!.organizationId,
      req.user!.id
    );
    res.json(thread);
  } catch (err) {
    next(err);
  }
}

export async function handleReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = reportThreadSchema.parse(req.body ?? {});
    await forumService.reportThread(
      req.params.threadId,
      req.user!.organizationId,
      req.user!.id,
      input.reason
    );
    res.status(201).json({ message: "Thread reported" });
  } catch (err) {
    next(err);
  }
}
