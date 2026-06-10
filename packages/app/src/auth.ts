import type { Provider, Session, User } from "@supabase/supabase-js";

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

/**
 * Returns the signUp result so callers can branch on `session`: non-null means
 * the user is signed in (email confirmations off); null means a confirmation
 * email was sent — including Supabase's obfuscated already-registered response,
 * which deliberately looks the same so account existence isn't leaked.
 */
export async function signUpWithPassword(
  client: AppSupabaseClient,
  { email, password, displayName }: SignUpInput,
  opts?: { emailRedirectTo?: string },
): Promise<{ user: User | null; session: Session | null }> {
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: displayName ? { display_name: displayName } : undefined,
      emailRedirectTo: opts?.emailRedirectTo,
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Verify the 6-digit sign-up confirmation code from the email (the manual
 * alternative to clicking the confirmation link). Unlike the link, this is not
 * PKCE-coupled, so it works from any browser/device. Establishes a session.
 */
export async function verifySignUpCode(
  client: AppSupabaseClient,
  email: string,
  token: string,
): Promise<void> {
  const { error } = await client.auth.verifyOtp({
    email,
    token,
    type: "signup",
  });
  if (error) throw error;
}

/** Re-send the sign-up confirmation email (link + code). */
export async function resendSignUpEmail(
  client: AppSupabaseClient,
  email: string,
  opts?: { emailRedirectTo?: string },
): Promise<void> {
  const { error } = await client.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: opts?.emailRedirectTo },
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
