import { Request, Response, NextFunction } from "express";
import {
  createFeatureFlagSchema,
  updateFeatureFlagSchema,
} from "../schemas/feature-flag.schema";
import * as featureFlagService from "../services/feature-flag.service";

export async function handleList(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const flags = await featureFlagService.listFeatureFlags(req.user!.organizationId);
    res.json({ data: flags });
  } catch (err) {
    next(err);
  }
}

export async function handleCreate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = createFeatureFlagSchema.parse(req.body);
    const flag = await featureFlagService.createFeatureFlag(
      req.user!.organizationId,
      req.user!.id,
      input
    );
    res.status(201).json(flag);
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
    const input = updateFeatureFlagSchema.parse(req.body);
    const flag = await featureFlagService.updateFeatureFlag(
      req.user!.organizationId,
      req.params.key,
      req.user!.id,
      input
    );
    res.json(flag);
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
    await featureFlagService.deleteFeatureFlag(
      req.user!.organizationId,
      req.params.key,
      req.user!.id
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
