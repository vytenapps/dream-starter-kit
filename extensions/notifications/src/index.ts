/**
 * Client-safe barrel — react-query hooks shared by web + native. Any
 * extension (or the dashboard) may import these to render a badge.
 */
export {
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from "./hooks/use-notifications";
