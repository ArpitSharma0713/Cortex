import { z } from "zod";

export const uploadDocumentSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
});
