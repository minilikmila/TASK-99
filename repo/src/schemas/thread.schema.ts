import { z } from "zod";
import { ThreadState } from "@prisma/client";

export const createThreadSchema = z.object({
  sectionId: z.string().min(1),
  subsectionId: z.string().min(1).optional(),
  title: z.string().min(1).max(500),
  body: z.string().min(1).max(50_000),
  tagIds: z.array(z.string().min(1)).max(20).optional(),
  isFeatured: z.boolean().optional(),
});

export const updateThreadSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  body: z.string().min(1).max(50_000).optional(),
});

export const threadStateSchema = z.object({
  toState: z.nativeEnum(ThreadState),
});

export const listThreadsSchema = z.object({
  sectionId: z.string().optional(),
  subsectionId: z.string().optional(),
  state: z.nativeEnum(ThreadState).optional(),
  isPinned: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  isFeatured: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  tag: z.string().optional(),
  page: z
    .string()
    .optional()
    .transform((v) => Math.max(1, parseInt(v ?? "1", 10) || 1)),
  pageSize: z
    .string()
    .optional()
    .transform((v) => Math.min(100, Math.max(1, parseInt(v ?? "20", 10) || 20))),
});

export type CreateThreadInput = z.infer<typeof createThreadSchema>;
export type UpdateThreadInput = z.infer<typeof updateThreadSchema>;
export type ThreadStateInput = z.infer<typeof threadStateSchema>;
export type ListThreadsQuery = z.infer<typeof listThreadsSchema>;
