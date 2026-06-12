import { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { SupabaseProvider, useSession } from "@acme/api";

import { supabase } from "~/lib/supabase";

import "../styles.css";
// Side-effect: installed extensions register their native boot handlers
// (e.g. notifications' foreground handler) via the generated registry.
import "~/ext/registry.generated";

/**
 * Redirects between the (auth) and (app) route groups based on session state.
 * Route groups (parens) don't appear in the URL, so targets are "/sign-in" / "/".
 */
function AuthGate() {
  const { user, isLoading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!user && !inAuthGroup) {
      router.replace("/sign-in");
    } else if (user && inAuthGroup) {
      router.replace("/");
    }
  }, [user, isLoading, segments, router]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <SupabaseProvider client={supabase}>
      <AuthGate />
      <StatusBar />
    </SupabaseProvider>
  );
}
