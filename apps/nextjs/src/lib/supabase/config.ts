import { env, SUPABASE_ANON_KEY_PLACEHOLDER, supabaseAnonKey } from "~/env";

/**
 * True once the app has real Supabase credentials. A one-click Vercel deploy
 * builds with placeholder env (see `~/env`), baking the placeholders into the
 * client bundle; until the real values are set AND the app is redeployed, the
 * browser points at the placeholder and auth calls fail with a cryptic
 * "Failed to fetch".
 *
 * Keyed off the anon-key sentinel because it's never a valid key — the URL
 * placeholder (`http://127.0.0.1:54321`) is also the real local-dev URL, so it
 * can't distinguish "unconfigured" from "local dev". `supabaseAnonKey()` also
 * accepts the integration's NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, so a deploy
 * connected with the new key name reads as configured.
 */
export function isSupabaseConfigured(): boolean {
  return supabaseAnonKey() !== SUPABASE_ANON_KEY_PLACEHOLDER;
}

/**
 * Mailpit web UI URL when the app points at a *local* Supabase stack, else
 * null. Locally GoTrue never sends real email — every auth email is captured
 * by Mailpit instead — so this is non-null exactly when "check your inbox"
 * actually means "check Mailpit". The port is pinned in supabase/config.toml
 * (`[inbucket] port = 54324`).
 */
export function localMailpitUrl(): string | null {
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      return null;
    }
    return `${url.protocol}//${url.hostname}:54324`;
  } catch {
    return null;
  }
}

/**
 * Turns an auth error into a user-facing message. Converts the bare
 * "Failed to fetch" you get from an unconfigured/unreachable Supabase into
 * something actionable instead of surfacing the raw network error.
 */
export function authErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (!isSupabaseConfigured()) {
    return "This app isn’t connected to a Supabase project yet. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — Vercel’s Supabase integration sets these), then redeploy.";
  }
  const message = error instanceof Error ? error.message : "";
  if (
    /failed to fetch|fetch failed|networkerror|load failed|network request failed/i.test(
      message,
    )
  ) {
    return "Couldn’t reach the authentication server. Check that your Supabase project is reachable, then try again.";
  }
  // A gateway hiccup can produce an empty/JSON-blob "message" (e.g. "{}") —
  // useless to a user, so fall back instead of toasting it verbatim.
  if (!message.trim() || /^[{[\]}\s]*$/.test(message)) return fallback;
  return message;
}
