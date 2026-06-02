import type { Provider } from "@supabase/supabase-js";

import type { AppSupabaseClient } from "@acme/api";

import type { SignInInput, SignUpInput } from "./validators/auth";

/**
 * Cross-platform auth actions over the injected Supabase client (web + native).
 * Each throws on error so callers can use try/catch or react-query.
 */

export async function signInWithPassword(
  client: AppSupabaseClient,
  { email, password }: SignInInput,
): Promise<void> {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpWithPassword(
  client: AppSupabaseClient,
  { email, password, displayName }: SignUpInput,
  opts?: { emailRedirectTo?: string },
): Promise<void> {
  const { error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: displayName ? { display_name: displayName } : undefined,
      emailRedirectTo: opts?.emailRedirectTo,
    },
  });
  if (error) throw error;
}

/** Magic-link / email OTP sign-in. */
export async function signInWithOtp(
  client: AppSupabaseClient,
  email: string,
  opts?: { emailRedirectTo?: string },
): Promise<void> {
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: opts?.emailRedirectTo },
  });
  if (error) throw error;
}

/**
 * OAuth sign-in. On web, pass a redirectTo to the /auth/callback route. On
 * native, pass skipBrowserRedirect:true and open the returned `url` with
 * expo-web-browser, then exchange the code from the deep link.
 */
export function signInWithOAuth(
  client: AppSupabaseClient,
  provider: Provider,
  opts?: { redirectTo?: string; skipBrowserRedirect?: boolean },
) {
  return client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: opts?.redirectTo,
      skipBrowserRedirect: opts?.skipBrowserRedirect,
    },
  });
}

export async function resetPasswordForEmail(
  client: AppSupabaseClient,
  email: string,
  redirectTo: string,
): Promise<void> {
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw error;
}

export async function updatePassword(
  client: AppSupabaseClient,
  password: string,
): Promise<void> {
  const { error } = await client.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut(client: AppSupabaseClient): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) throw error;
}
