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
  opts?: { captchaToken?: string },
): Promise<void> {
  const { error } = await client.auth.signInWithPassword({
    email,
    password,
    options: opts?.captchaToken
      ? { captchaToken: opts.captchaToken }
      : undefined,
  });
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
  opts?: { emailRedirectTo?: string; captchaToken?: string },
): Promise<{ user: User | null; session: Session | null }> {
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: displayName ? { display_name: displayName } : undefined,
      emailRedirectTo: opts?.emailRedirectTo,
      captchaToken: opts?.captchaToken,
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

/**
 * Verify a 6-digit email **login** code (the OTP sign-in method, distinct from
 * the sign-up confirmation code in `verifySignUpCode`). Pairs with
 * `signInWithOtp` to complete a passwordless code sign-in; establishes a session.
 */
export async function verifyEmailLoginCode(
  client: AppSupabaseClient,
  email: string,
  token: string,
): Promise<void> {
  const { error } = await client.auth.verifyOtp({
    email,
    token,
    type: "email",
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
  opts?: { emailRedirectTo?: string; captchaToken?: string },
): Promise<void> {
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: opts?.emailRedirectTo,
      captchaToken: opts?.captchaToken,
    },
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

/**
 * SAML 2.0 SSO sign-in. Pass `providerId` (a registered Supabase SSO provider)
 * or an email `domain` to let Supabase resolve the provider. Returns
 * `{ data: { url }, error }`; on web redirect to `data.url`, on native open it
 * with expo-web-browser and exchange the code from the deep link (like OAuth).
 *
 * Requires SAML enabled in Supabase ([auth.sso]) with an IdP registered via
 * `supabase sso add` — this is gated in the UI by the auth-settings global but
 * the actual capability lives in GoTrue (see docs/AUTH.md).
 */
export function signInWithSSO(
  client: AppSupabaseClient,
  params: { domain?: string; providerId?: string },
  opts?: { redirectTo?: string; skipBrowserRedirect?: boolean },
) {
  const options = {
    redirectTo: opts?.redirectTo,
    skipBrowserRedirect: opts?.skipBrowserRedirect,
  };
  return client.auth.signInWithSSO(
    params.providerId
      ? { providerId: params.providerId, options }
      : { domain: params.domain ?? "", options },
  );
}

export async function resetPasswordForEmail(
  client: AppSupabaseClient,
  email: string,
  redirectTo: string,
  opts?: { captchaToken?: string },
): Promise<void> {
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo,
    captchaToken: opts?.captchaToken,
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

/**
 * Ensure the visitor has *some* Supabase session, minting an **anonymous** one
 * if they're logged out. Called before the first per-user write (e.g. favoriting
 * any content) so the action ties to a real `auth.uid()` — later converted to a
 * permanent account once an email is known at checkout. Idempotent: returns the
 * existing user when already signed in (anonymous or not).
 *
 * `captchaToken` is required when Supabase has CAPTCHA enabled (anonymous
 * sign-ins are the prime bot target — see docs/TURNSTILE.md).
 */
export async function ensureAnonSession(
  client: AppSupabaseClient,
  opts?: { captchaToken?: string },
): Promise<User> {
  const { data: sessionData } = await client.auth.getSession();
  const existing = sessionData.session?.user;
  if (existing) return existing;

  const { data, error } = await client.auth.signInAnonymously({
    options: opts?.captchaToken
      ? { captchaToken: opts.captchaToken }
      : undefined,
  });
  if (error) throw error;
  if (!data.user) throw new Error("Anonymous sign-in returned no user.");
  return data.user;
}

/** True when the signed-in user is a Supabase anonymous user. */
export function isAnonymousUser(user: User | null | undefined): boolean {
  return Boolean(user?.is_anonymous);
}

/**
 * Convert the current anonymous user to a permanent one by attaching an email.
 * Supabase sends a confirmation email (with `enable_confirmations`); the user
 * becomes permanent on click. Optionally stamp profile data (name/phone/address)
 * into user_metadata at the same time. Throws on conflict (`email_exists`) so the
 * caller can run the merge path. No-op-safe to call only when `is_anonymous`.
 */
export async function convertAnonToPermanent(
  client: AppSupabaseClient,
  email: string,
  opts?: { emailRedirectTo?: string; data?: Record<string, unknown> },
): Promise<void> {
  const { error } = await client.auth.updateUser(
    { email, data: opts?.data },
    opts?.emailRedirectTo
      ? { emailRedirectTo: opts.emailRedirectTo }
      : undefined,
  );
  if (error) throw error;
}
