/**
 * Client-safe barrel — validator + react-query hooks shared by web + native,
 * plus the pure upcoming-reminders helper (dashboard widget fodder).
 */
export * from "./validators/reminder";
export {
  useCreateReminder,
  useDeleteReminder,
  useReminders,
} from "./hooks/use-reminders";
export * from "./upcoming";
