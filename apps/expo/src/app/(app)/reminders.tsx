import { Alert, FlatList, View } from "react-native";
import { Stack } from "expo-router";

import { useCreateReminder, useDeleteReminder, useReminders } from "@acme/app";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";

const msg = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong";

const HOUR = 60 * 60 * 1000;

export default function Reminders() {
  const reminders = useReminders();
  const createReminder = useCreateReminder();
  const deleteReminder = useDeleteReminder();

  async function schedule(offsetMs: number) {
    try {
      await createReminder.mutateAsync({
        dueAt: new Date(Date.now() + offsetMs).toISOString(),
        channel: "push",
      });
    } catch (e) {
      Alert.alert("Error", msg(e));
    }
  }

  return (
    <View className="bg-background flex-1 gap-3 p-4">
      <Stack.Screen options={{ title: "Reminders" }} />
      <Text className="text-muted-foreground text-sm">
        Schedule a push reminder:
      </Text>
      <View className="flex-row gap-2">
        <Button
          title="In 1 hour"
          loading={createReminder.isPending}
          onPress={() => void schedule(HOUR)}
        />
        <Button
          title="Tomorrow"
          variant="outline"
          onPress={() => void schedule(24 * HOUR)}
        />
      </View>
      <FlatList
        data={reminders.data ?? []}
        keyExtractor={(r) => r.id}
        ListEmptyComponent={
          <Text className="text-muted-foreground">
            {reminders.isLoading ? "Loading…" : "No reminders."}
          </Text>
        }
        renderItem={({ item }) => (
          <View className="border-border flex-row items-center justify-between border-b py-3">
            <Text className="flex-1 text-sm">
              {new Date(item.due_at).toLocaleString()} · {item.channel} ·{" "}
              {item.status}
            </Text>
            <Button
              title="Delete"
              variant="ghost"
              onPress={() => void deleteReminder.mutateAsync(item.id)}
            />
          </View>
        )}
      />
    </View>
  );
}
