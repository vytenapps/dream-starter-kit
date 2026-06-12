import { Pressable, Text } from "react-native";
import { Stack, useRouter } from "expo-router";

import { hasExtension } from "~/ext/registry.generated";

function HeaderBell() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/x/notifications")}
      hitSlop={8}
      accessibilityLabel="Notifications"
    >
      <Text style={{ color: "#fff", fontSize: 18, marginRight: 12 }}>🔔</Text>
    </Pressable>
  );
}

export default function AppLayout() {
  // The bell is the notifications extension's surface — hidden when the
  // extension isn't installed (EXTENSIONS-PLAN.md §2.5).
  const showBell = hasExtension("notifications");
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#c03484" },
        headerTintColor: "#fff",
        ...(showBell ? { headerRight: () => <HeaderBell /> } : {}),
      }}
    />
  );
}
