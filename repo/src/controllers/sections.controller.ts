import { Request, Response, NextFunction } from "express";
import {
  createSectionSchema,
  updateSectionSchema,
  createSubsectionSchema,
} from "../schemas/section.schema";
import * as sectionService from "../services/section.service";

export async function handleListSections(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sections = await sectionService.listSections(req.user!.organizationId);
    res.json({ data: sections });
  } catch (err) {
    next(err);
  }
}

export async function handleCreateSection(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = createSectionSchema.parse(req.body);
    const section = await sectionService.createSection(
      req.user!.organizationId,
      req.user!.id,
      input
    );
    res.status(201).json(section);
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateSection(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = updateSectionSchema.parse(req.body);
    const section = await sectionService.updateSection(
      req.params.sectionId,
      req.user!.organizationId,
      req.user!.id,
      input
    );
    res.json(section);
  } catch (err) {
    next(err);
  }
}

export async function handleListSubsections(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const subsections = await sectionService.listSubsections(
      req.params.sectionId
    );
    res.json({ data: subsections });
  } catch (err) {
    next(err);
  }
}

export async function handleCreateSubsection(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = createSubsectionSchema.parse(req.body);
    const subsection = await sectionService.createSubsection(
      req.params.sectionId,
      req.user!.organizationId,
      req.user!.id,
      input
    );
    res.status(201).json(subsection);
  } catch (err) {
    next(err);
  }
}
