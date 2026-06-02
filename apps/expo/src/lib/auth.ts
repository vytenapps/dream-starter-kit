import type { Provider } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { signInWithOAuth } from "@acme/app";

import { supabase } from "./supabase";

/**
 * Native OAuth: open the provider in an auth session, capture the deep-link
 * callback (meetdream://auth-callback?code=…), and exchange the code for a
 * session. The session change is picked up by useSession (AuthGate redirects).
 */
export async function nativeOAuth(provider: Provider): Promise<void> {
  const redirectTo = Linking.createURL("/auth-callback");

  const { data, error } = await signInWithOAuth(supabase, provider, {
    redirectTo,
    skipBrowserRedirect: true,
  });
  if (error) throw error;
  if (!data.url) throw new Error("No OAuth URL returned");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return; // user dismissed

  const code = new URL(result.url).searchParams.get("code");
  if (!code) throw new Error("No code in callback URL");

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
}
