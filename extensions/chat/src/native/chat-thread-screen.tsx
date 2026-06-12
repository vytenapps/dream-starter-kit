import { useState } from "react";
import { Alert, FlatList, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { Button } from "@acme/ui-native/button";
import { cn } from "@acme/ui-native/cn";
import { Input } from "@acme/ui-native/input";
import { Text } from "@acme/ui-native/text";

import { useSendMessage, useThreadMessages } from "../index";

// `EXPO_PUBLIC_*` is inlined by Metro at build time — literal reads only.
declare const process: { env: Record<string, string | undefined> };
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

const msg = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong";

export function ChatThreadScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const messages = useThreadMessages(threadId);
  const send = useSendMessage(threadId, API_BASE);
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
        <Button
          title="Send"
          loading={send.isPending}
          onPress={() => void onSend()}
        />
      </View>
    </View>
  );
}
