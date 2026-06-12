import { FlatList, View } from "react-native";
import { Stack } from "expo-router";

import { useEvents } from "@acme/app";
import { Text } from "@acme/ui-native/text";

export default function EventsList() {
  const events = useEvents();

  return (
    <View className="bg-background flex-1 gap-3 p-4">
      <Stack.Screen options={{ title: "Events" }} />
      <FlatList
        data={events.data ?? []}
        keyExtractor={(event) => String(event.id)}
        ListEmptyComponent={
          <Text className="text-muted-foreground">
            {events.isLoading ? "Loading…" : "No events yet."}
          </Text>
        }
        renderItem={({ item }) => (
          <View className="border-border border-b py-3">
            <Text className="text-base font-medium">{item.title}</Text>
            <Text className="text-muted-foreground text-sm">
              {new Date(item.startsAt).toLocaleString()}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
