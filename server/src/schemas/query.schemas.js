import { z } from "zod";

export const querySchema = z.object({
  question: z.string().trim().min(3).max(1000),
});

