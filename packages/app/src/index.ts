/**
 * @acme/app — shared, cross-platform feature logic (validators, auth actions,
 * data hooks). UI stays per-platform in apps/*; the logic lives here so web and
 * native share one implementation.
 */

export * from "./validators/auth";
export * from "./validators/reminder";
export * from "./validators/tag";
export * from "./auth";
export * from "./reminders";
export * from "./hooks/use-content";
export { useProfile, useUpdateProfile } from "./hooks/use-profile";
export { useDeleteAccount } from "./hooks/use-delete-account";
export { usePremium } from "./hooks/use-premium";
export {
  useChatThreads,
  useCreateThread,
  useDeleteThread,
  useThreadMessages,
  useSendMessage,
} from "./hooks/use-chat";
export {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
} from "./hooks/use-notifications";
export {
  useReminders,
  useCreateReminder,
  useDeleteReminder,
} from "./hooks/use-reminders";
export { useUserTags } from "./hooks/use-tags";
export type { UserTag } from "./hooks/use-tags";
