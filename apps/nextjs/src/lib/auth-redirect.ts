/**
 * Pure, dependency-free origin/redirect helpers shared by `~/lib/site-url`, the
 * auth callback route, and the proxy middleware. Kept env- and Next-free so they
 * can be unit-tested in isolation (see `site-url.test.ts`).
 */

/**
 * Add an `https://` scheme when one is missing (Vercel's `VERCEL_URL` etc. arrive
 * bare, e.g. `my-app.vercel.app`) and strip any trailing slash, so the result is
 * a clean origin with no trailing `/`.
 */
export function normalizeOrigin(raw: string): string {
  const withScheme = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, "");
}

/**
 * The public origin of the current request, derived from the forwarded headers
 * Vercel's proxy sets to the *public* host (`x-forwarded-host` / `-proto`) — not
 * the internal deployment host that `request.url` can carry. Returns `null` when
 * no host header is present (e.g. some test/edge contexts), so callers can fall
 * back to the env-based `getSiteUrl()`.
 */
export function originFromHeaders(headers: Headers): string | null {
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return null;
  const proto = headers.get("x-forwarded-proto") ?? "https";
  return normalizeOrigin(`${proto}://${host}`);
}

/**
 * Supabase delivers the auth `code` (PKCE) / `token_hash` (OTP) to whatever
 * `redirect_to` it accepted. When the app's `emailRedirectTo` isn't in the
 * project's allow-list, Supabase falls back to the project **Site URL** and
 * drops our `/auth/callback` path — the code then lands on the site root as
 * `/?code=…`. Given the landing path + query, decide whether to funnel the
 * request to `/auth/callback` and which `next` destination to use afterwards.
 * Returns `null` when no funnel is needed (already on the callback, or no code).
 *
 * This makes sign-in complete even with an imperfect Supabase redirect config,
 * as long as the email returns to the correct host.
 */
export function authCodeFunnelNext(
  pathname: string,
  searchParams: URLSearchParams,
): string | null {
  if (pathname === "/auth/callback") return null;
  if (!searchParams.has("code") && !searchParams.has("token_hash")) return null;
  // Preserve a same-origin landing path as the post-auth destination; the bare
  // site-root fallback (`/`) has nowhere meaningful to go, so use the dashboard.
  return pathname === "/" ? "/dashboard" : pathname;
}
