import { Request, Response, NextFunction } from "express";
import {
  createTagSchema,
  updateTagSchema,
} from "../schemas/tag.schema";
import * as tagService from "../services/tag.service";

export async function handleListTags(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tags = await tagService.listTags(req.user!.organizationId);
    res.json({ data: tags });
  } catch (err) {
    next(err);
  }
}

export async function handleCreateTag(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = createTagSchema.parse(req.body);
    const tag = await tagService.createTag(
      req.user!.organizationId,
      req.user!.id,
      input
    );
    res.status(201).json(tag);
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateTag(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = updateTagSchema.parse(req.body);
    const tag = await tagService.updateTag(
      req.params.tagId,
      req.user!.organizationId,
      req.user!.id,
      input
    );
    res.json(tag);
  } catch (err) {
    next(err);
  }
}

export async function handleDeleteTag(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await tagService.deleteTag(
      req.params.tagId,
      req.user!.organizationId,
      req.user!.id
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
