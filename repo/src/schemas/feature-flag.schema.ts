import { z } from "zod";

export const createFeatureFlagSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z][a-z0-9_]*$/, "Key must be lowercase snake_case"),
  value: z.boolean().default(false),
  description: z.string().max(500).optional(),
});

export const updateFeatureFlagSchema = z.object({
  value: z.boolean(),
  description: z.string().max(500).optional(),
});

export type CreateFeatureFlagInput = z.infer<typeof createFeatureFlagSchema>;
export type UpdateFeatureFlagInput = z.infer<typeof updateFeatureFlagSchema>;
