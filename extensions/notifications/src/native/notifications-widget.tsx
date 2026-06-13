import { Pressable } from "react-native";
import { useRouter } from "expo-router";

import { Text } from "@acme/ui-native/text";

import { useUnreadCount } from "../index";

/** Home-screen widget: unread notification count. */
export function NotificationsWidget() {
  const router = useRouter();
  const unread = useUnreadCount();

  return (
    <Pressable
      className="border-border w-full rounded-md border p-3"
      onPress={() => router.push("/a/notifications")}
    >
      <Text className="text-muted-foreground text-xs">Notifications</Text>
      <Text className="text-base font-medium">
        {unread === 0 ? "All caught up" : `${unread} unread`}
      </Text>
    </Pressable>
  );
}
