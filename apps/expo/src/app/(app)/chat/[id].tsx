import { useState } from "react";
import { Alert, FlatList, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { useSendMessage, useThreadMessages } from "@acme/app";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { cn } from "~/lib/cn";
import { clientEnv } from "~/lib/env";

const msg = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong";

export default function ChatThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const messages = useThreadMessages(id);
  const send = useSendMessage(id, clientEnv.APP_URL);
  const [input, setInput] = useState("");

  async function onSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    try {
      await send.mutateAsync(text);
    } catch (e) {
      Alert.alert("Error", msg(e));
    }
  }

  return (
    <View className="bg-background flex-1 p-4">
      <Stack.Screen options={{ title: "Chat" }} />
      <FlatList
        className="flex-1"
        data={messages.data ?? []}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <View
            className={cn(
              "my-1",
              item.role === "user" ? "items-end" : "items-start",
            )}
          >
            <Text
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2",
                item.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              {item.content}
            </Text>
          </View>
        )}
        ListFooterComponent={
          send.isPending ? (
            <Text className="text-muted-foreground py-2 text-sm">
              Assistant is thinking…
            </Text>
          ) : null
        }
      />
      <View className="border-border flex-row gap-2 border-t pt-3">
        <Input
          className="flex-1"
          value={input}
          onChangeText={setInput}
          placeholder="Message…"
          editable={!send.isPending}
        />
        <Button title="Send" loading={send.isPending} onPress={() => void onSend()} />
      </View>
    </View>
  );
}
