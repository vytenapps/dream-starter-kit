import { z } from "zod/v4";

/** Input for creating/assigning a user tag (used by the staff admin endpoint). */
export const createTagSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  /** Optional badge color (hex or utility token). */
  color: z.string().max(32).optional(),
});
export type CreateTagInput = z.infer<typeof createTagSchema>;
