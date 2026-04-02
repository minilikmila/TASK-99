import { z } from "zod";

export const createReplySchema = z.object({
  parentReplyId: z.string().min(1).nullable().optional(),
  body: z.string().min(1).max(20_000),
});

export const updateReplySchema = z.object({
  body: z.string().min(1).max(20_000),
});

export type CreateReplyInput = z.infer<typeof createReplySchema>;
export type UpdateReplyInput = z.infer<typeof updateReplySchema>;
