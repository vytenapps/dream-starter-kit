import { Text, View } from "react-native";
import { Stack } from "expo-router";

import { useSession } from "@acme/api";
import { APP_NAME } from "@acme/config/constants";

export default function Index() {
  const { user, isLoading } = useSession();

  return (
    <View className="bg-background flex-1 items-center justify-center gap-4 p-6">
      <Stack.Screen options={{ title: APP_NAME }} />
      <Text className="text-foreground text-4xl font-bold">Meet Dream</Text>
      <Text className="text-muted-foreground text-center text-base">
        Universal starter — web + mobile on one Supabase backend.
      </Text>
      <Text className="text-muted-foreground text-sm">
        {isLoading
          ? "Checking session…"
          : user
            ? `Signed in as ${user.email}`
            : "Not signed in — auth lands in Phase 3."}
      </Text>
    </View>
  );
}
