import { Pressable } from "react-native";
import { useRouter } from "expo-router";

import { Text } from "@acme/ui-native/text";

import { useReminders } from "../index";

/** Home-screen widget: upcoming (pending) reminders. */
export function RemindersWidget() {
  const router = useRouter();
  const reminders = useReminders();
  const pending =
    reminders.data?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <Pressable
      className="border-border w-full rounded-md border p-3"
      onPress={() => router.push("/x/reminders")}
    >
      <Text className="text-muted-foreground text-xs">Reminders</Text>
      <Text className="text-base font-medium">
        {pending === 0 ? "Nothing scheduled" : `${pending} upcoming`}
      </Text>
    </Pressable>
  );
}
