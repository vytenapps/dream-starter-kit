import { useColorScheme } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { SupabaseProvider } from "@acme/api";

import { supabase } from "~/lib/supabase";

import "../styles.css";

// Root layout: wraps the app with the shared Supabase + react-query provider
// (the native client persists sessions via AsyncStorage).
export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <SupabaseProvider client={supabase}>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: "#c03484",
          },
          contentStyle: {
            backgroundColor: colorScheme === "dark" ? "#09090B" : "#FFFFFF",
          },
        }}
      />
      <StatusBar />
    </SupabaseProvider>
  );
}
