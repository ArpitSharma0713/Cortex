import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  mode: z.enum(["general", "developer", "creative"]).default("general"),
});

export const updateWorkspaceSchema = z
  .object({
    name: z.string().min(1).max(100).trim().optional(),
    description: z.string().max(500).trim().optional(),
    mode: z.enum(["general", "developer", "creative"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
