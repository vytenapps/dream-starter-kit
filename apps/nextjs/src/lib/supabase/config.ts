import { env, SUPABASE_ANON_KEY_PLACEHOLDER } from "~/env";

/**
 * True once the app has real Supabase credentials. A one-click Vercel deploy
 * builds with placeholder env (see `~/env`), baking the placeholders into the
 * client bundle; until the real values are set AND the app is redeployed, the
 * browser points at the placeholder and auth calls fail with a cryptic
 * "Failed to fetch".
 *
 * Keyed off the anon-key sentinel because it's never a valid key — the URL
 * placeholder (`http://127.0.0.1:54321`) is also the real local-dev URL, so it
 * can't distinguish "unconfigured" from "local dev".
 */
export function isSupabaseConfigured(): boolean {
  return env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== SUPABASE_ANON_KEY_PLACEHOLDER;
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
    return "This app isn’t connected to a Supabase project yet. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (Vercel’s Supabase integration sets both), then redeploy.";
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
