import type { Provider } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { signInWithOAuth, signInWithSSO } from "@acme/app";

import { supabase } from "./supabase";

/** Exchange an authorization code (from a deep-link callback) for a session. */
async function exchangeCallbackCode(callbackUrl: string): Promise<void> {
  const code = new URL(callbackUrl).searchParams.get("code");
  if (!code) throw new Error("No code in callback URL");
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
}

/**
 * Native OAuth: open the provider in an auth session, capture the deep-link
 * callback (dreamstarter://auth-callback?code=…), and exchange the code for a
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

  await exchangeCallbackCode(result.url);
}

/**
 * Native SAML SSO: resolve the identity provider (by `providerId` or email
 * `domain`), open it in an auth session, and exchange the deep-link code — same
 * flow as {@link nativeOAuth}. Requires SAML enabled in Supabase (see
 * docs/AUTH.md); gated in the UI by the auth-settings global.
 */
export async function nativeSSO(params: {
  domain?: string;
  providerId?: string;
}): Promise<void> {
  const redirectTo = Linking.createURL("/auth-callback");

  const { data, error } = await signInWithSSO(supabase, params, {
    redirectTo,
    skipBrowserRedirect: true,
  });
  if (error) throw error;
  if (!data.url) throw new Error("SSO is not available for that email");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return; // user dismissed

  await exchangeCallbackCode(result.url);
}
