import { Request, Response, NextFunction } from "express";
import {
  createThreadSchema,
  updateThreadSchema,
  threadStateSchema,
  listThreadsSchema,
} from "../schemas/thread.schema";
import * as forumService from "../services/forum.service";
import { buildPaginatedResponse } from "../lib/response";

export async function handleCreate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = createThreadSchema.parse(req.body);
    const thread = await forumService.createThread(
      req.user!.organizationId,
      req.user!.id,
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
      req.user!.id
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
