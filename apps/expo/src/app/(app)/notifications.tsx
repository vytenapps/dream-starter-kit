import { Alert, FlatList, Pressable, View } from "react-native";
import { Stack } from "expo-router";

import { useSupabase } from "@acme/api";
import { useMarkNotificationRead, useNotifications } from "@acme/app";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { clientEnv } from "~/lib/env";
import { registerForPushNotifications } from "~/lib/push";

export default function Notifications() {
  const supabase = useSupabase();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();

  async function onEnablePush() {
    const token = await registerForPushNotifications(supabase);
    Alert.alert(
      token ? "Push enabled" : "Push unavailable",
      token
        ? "This device is registered for notifications."
        : "Remote push needs a dev build on a physical device.",
    );
  }

  async function onSendTest() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(`${clientEnv.APP_URL}/api/push/test`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const json = (await res.json()) as { sent?: number; error?: string };
    Alert.alert(
      res.ok ? "Sent" : "Failed",
      res.ok ? `Sent to ${json.sent ?? 0} device(s)` : (json.error ?? "Error"),
    );
  }

  return (
    <View className="bg-background flex-1 gap-3 p-4">
      <Stack.Screen options={{ title: "Notifications" }} />
      <View className="flex-row gap-2">
        <Button title="Enable push" onPress={() => void onEnablePush()} />
        <Button
          title="Send test"
          variant="outline"
          onPress={() => void onSendTest()}
        />
      </View>
      <FlatList
        data={notifications.data ?? []}
        keyExtractor={(n) => n.id}
        ListEmptyComponent={
          <Text className="text-muted-foreground">
            {notifications.isLoading ? "Loading…" : "No notifications yet."}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              if (!item.read_at) void markRead.mutateAsync(item.id);
            }}
            className="border-border border-b py-3"
          >
            <Text
              className={
                item.read_at
                  ? "text-muted-foreground"
                  : "text-foreground font-medium"
              }
            >
              {item.title ?? item.type}
            </Text>
            {item.body ? (
              <Text className="text-muted-foreground text-sm">{item.body}</Text>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}
