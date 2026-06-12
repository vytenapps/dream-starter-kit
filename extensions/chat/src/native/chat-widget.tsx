import { Pressable } from "react-native";
import { useRouter } from "expo-router";

import { Text } from "@acme/ui-native/text";

import { useChatThreads } from "../index";

/** Home-screen widget: recent chats. */
export function ChatWidget() {
  const router = useRouter();
  const threads = useChatThreads();
  const count = threads.data?.length ?? 0;

  return (
    <Pressable
      className="border-border w-full rounded-md border p-3"
      onPress={() => router.push("/x/chat")}
    >
      <Text className="text-muted-foreground text-xs">AI Chat</Text>
      <Text className="text-base font-medium">
        {count === 0
          ? "Start a chat"
          : `${count} thread${count === 1 ? "" : "s"}`}
      </Text>
    </Pressable>
  );
}
