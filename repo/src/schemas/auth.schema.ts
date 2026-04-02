import { z } from "zod";

export const loginSchema = z.object({
  organizationSlug: z.string().min(1, "Organization slug is required"),
  username: z.string().min(1, "Username is required"),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;
