import { Alert, FlatList, Pressable, View } from "react-native";
import { Stack, useRouter } from "expo-router";

import { Button } from "@acme/ui-native/button";
import { Text } from "@acme/ui-native/text";

import { useChatThreads, useCreateThread, useDeleteThread } from "../index";

const msg = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong";

export function ChatListScreen() {
  const router = useRouter();
  const threads = useChatThreads();
  const createThread = useCreateThread();
  const deleteThread = useDeleteThread();

  async function onNew() {
    try {
      const thread = await createThread.mutateAsync(undefined);
      router.push(`/a/chat/${thread.id}`);
    } catch (e) {
      Alert.alert("Error", msg(e));
    }
  }

  return (
    <View className="bg-background flex-1 gap-3 p-4">
      <Stack.Screen options={{ title: "Chat" }} />
      <Button
        title="New chat"
        loading={createThread.isPending}
        onPress={() => void onNew()}
      />
      <FlatList
        data={threads.data ?? []}
        keyExtractor={(thread) => thread.id}
        ListEmptyComponent={
          <Text className="text-muted-foreground">
            {threads.isLoading ? "Loading…" : "No chats yet."}
          </Text>
        }
        renderItem={({ item }) => (
          <View className="border-border flex-row items-center justify-between border-b py-3">
            <Pressable
              className="flex-1"
              onPress={() => router.push(`/a/chat/${item.id}`)}
            >
              <Text className="text-base">{item.title ?? "Untitled"}</Text>
            </Pressable>
            <Button
              title="Delete"
              variant="ghost"
              onPress={() => void deleteThread.mutateAsync(item.id)}
            />
          </View>
        )}
      />
    </View>
  );
}
