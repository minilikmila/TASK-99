import { Request, Response, NextFunction } from "express";
import { createReplySchema, updateReplySchema } from "../schemas/reply.schema";
import * as forumService from "../services/forum.service";
import { AppError } from "../middleware/errorHandler";
import { ErrorCode } from "../types";

export async function handleCreate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user!;

    if (user.muteUntil && user.muteUntil > new Date()) {
      throw new AppError(
        403,
        ErrorCode.USER_MUTED,
        `You are muted until ${user.muteUntil.toISOString()}`
      );
    }

    const input = createReplySchema.parse(req.body);
    const reply = await forumService.createReply(
      user.organizationId,
      user.id,
      req.params.threadId,
      input
    );
    res.status(201).json(reply);
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
    const replies = await forumService.listReplies(
      req.params.threadId,
      req.user!.organizationId
    );
    res.json({ data: replies });
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
    const input = updateReplySchema.parse(req.body);
    const reply = await forumService.updateReply(
      req.params.replyId,
      req.user!.organizationId,
      req.user!.id,
      input
    );
    res.json(reply);
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
    await forumService.deleteReply(
      req.params.replyId,
      req.user!.organizationId,
      req.user!.id
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
