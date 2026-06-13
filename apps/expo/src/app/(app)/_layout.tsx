import { Pressable, Text } from "react-native";
import { Stack, useRouter } from "expo-router";

import { ExtWidgetsProvider } from "@acme/ext-kit/react";

import { extWidgets, hasExtension } from "~/ext/registry.generated";

function HeaderBell() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/a/notifications")}
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
    // Home-screen widgets from the generated registry (all installed; the
    // runtime kit-extensions disable toggle gates native at the menu level).
    <ExtWidgetsProvider widgets={extWidgets}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#c03484" },
          headerTintColor: "#fff",
          ...(showBell ? { headerRight: () => <HeaderBell /> } : {}),
        }}
      />
    </ExtWidgetsProvider>
  );
}
