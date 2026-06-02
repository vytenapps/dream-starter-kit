import { Pressable, Text } from "react-native";
import { Stack, useRouter } from "expo-router";

function HeaderBell() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/notifications")}
      hitSlop={8}
      accessibilityLabel="Notifications"
    >
      <Text style={{ color: "#fff", fontSize: 18, marginRight: 12 }}>🔔</Text>
    </Pressable>
  );
}

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#c03484" },
        headerTintColor: "#fff",
        headerRight: () => <HeaderBell />,
      }}
    />
  );
}
