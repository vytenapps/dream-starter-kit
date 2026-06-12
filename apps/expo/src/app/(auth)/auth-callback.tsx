import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";

import { Text } from "@acme/ui-native/text";

import { supabase } from "~/lib/supabase";

/**
 * Deep-link landing for Supabase auth emails (dreamstarter://auth-callback?code=…):
 * sign-up confirmation, magic link, and password recovery all redirect here (see
 * the emailRedirectTo args across (auth) screens). Exchanges the PKCE code for a
 * session; the AuthGate in _layout.tsx then routes into the (app) group.
 *
 * Lives in the (auth) group so an unauthenticated user isn't bounced to /sign-in
 * mid-exchange (route groups don't affect the /auth-callback URL).
 */
export default function AuthCallback() {
  const { code, error_description: errorDescription } = useLocalSearchParams<{
    code?: string;
    error_description?: string;
  }>();
  const [exchangeError, setExchangeError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    void supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      // On success the session lands in storage and AuthGate redirects to "/".
      if (error) setExchangeError(error.message);
    });
  }, [code]);

  // A link without a code never starts an exchange — derive that error instead
  // of setting state in the effect.
  const error = code
    ? exchangeError
    : (errorDescription ?? "This link is invalid or has expired.");

  return (
    <View className="bg-background flex-1 items-center justify-center gap-4 p-6">
      {error ? (
        <>
          <Text className="text-xl font-bold">Sign-in link didn’t work</Text>
          <Text className="text-muted-foreground text-center">{error}</Text>
          <Link href="/sign-in">
            <Text className="text-primary">Back to sign in</Text>
          </Link>
        </>
      ) : (
        <>
          <ActivityIndicator />
          <Text className="text-muted-foreground">Signing you in…</Text>
        </>
      )}
    </View>
  );
}
