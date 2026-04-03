import { z } from "zod";

export const loginSchema = z.object({
  organizationSlug: z.string().min(1, "Organization slug is required"),
  username: z.string().min(1, "Username is required"),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const provisionUserSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(12, "Password must be at least 12 characters"),
  role: z.enum(["ADMINISTRATOR", "MODERATOR", "ANALYST", "USER"]).default("USER"),
});

export type ProvisionUserInput = z.infer<typeof provisionUserSchema>;
