import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#c03484" },
        headerTintColor: "#fff",
      }}
    />
  );
}
