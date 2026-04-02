import { z } from "zod";

export const createSectionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

export const updateSectionSchema = createSectionSchema.partial();

export const createSubsectionSchema = z.object({
  name: z.string().min(1).max(200),
});

export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;
export type CreateSubsectionInput = z.infer<typeof createSubsectionSchema>;
