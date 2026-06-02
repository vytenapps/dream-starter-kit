import { z } from "zod/v4";

/** Item lifecycle statuses (the DB column is free-text; the app constrains it). */
export const ITEM_STATUSES = ["open", "in_progress", "done"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const createItemSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  // Required here; forms supply the default ("open") via defaultValues so the
  // schema's input and output types stay identical (react-hook-form friendly).
  status: z.enum(ITEM_STATUSES),
});
export type CreateItemInput = z.infer<typeof createItemSchema>;

export const updateItemSchema = z.object({
  title: z.string().min(1, "Title is required").max(200).optional(),
  status: z.enum(ITEM_STATUSES).optional(),
});
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
