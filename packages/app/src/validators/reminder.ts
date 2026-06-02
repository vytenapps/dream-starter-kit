import { z } from "zod/v4";

export const REMINDER_CHANNELS = ["push", "email"] as const;
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];

export const createReminderSchema = z.object({
  /** ISO timestamp (e.g. from a datetime-local input, converted to ISO). */
  dueAt: z.string().min(1, "Pick a date and time"),
  channel: z.enum(REMINDER_CHANNELS),
  itemId: z.uuid().optional(),
});
export type CreateReminderInput = z.infer<typeof createReminderSchema>;
