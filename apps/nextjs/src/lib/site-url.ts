import { env } from "~/env";
import { normalizeOrigin, originFromHeaders } from "./auth-redirect";

export { normalizeOrigin, originFromHeaders } from "./auth-redirect";

/**
 * The public origin of the web app, correct in Client Components, Server
 * Components, Route Handlers, and during SSR. The single source of truth for the
 * canonical absolute URLs the app emits (auth email/OAuth redirects, OG
 * `metadataBase`, sitemap, robots).
 *
 * Resolution:
 *   • On the **client**, the live `window.location.origin` IS the truth — it
 *     always matches the domain the user is actually on (any `*.vercel.app`
 *     production/preview/branch URL, a custom domain, or localhost), with ZERO
 *     dependence on Vercel's "Expose System Environment Variables" project
 *     setting. (That setting is what gates the `NEXT_PUBLIC_VERCEL_*` vars; a
 *     one-click/marketplace deploy often leaves it off, which is how auth emails
 *     previously resolved to `http://localhost:3000`.)
 *   • On the **server**, resolve from the validated env (first non-empty wins):
 *       1. NEXT_PUBLIC_SITE_URL          — explicit override (custom domain).
 *       2. VERCEL_PROJECT_PRODUCTION_URL — the project's STABLE production domain.
 *          From the `vercel()` env preset; ALWAYS set on Vercel server-side (no
 *          NEXT_PUBLIC_ / "expose system env" setting needed), so canonical/SEO
 *          URLs resolve reliably. Best for OG/sitemap.
 *       3. VERCEL_URL                    — the per-deployment URL (preset).
 *       4. NEXT_PUBLIC_APP_URL           — local/dev default (http://localhost:3000).
 *
 * For per-request server redirects that must return the user to the SAME
 * deployment they're on (auth callback, Stripe), prefer `originFromRequest()`.
 *
 * NOTE: this only controls the URLs the *app* generates. Supabase still validates
 * every redirect against its own allow-list — set the project's **Site URL** and
 * **Redirect URLs** (Authentication → URL Configuration) to your deployed origin
 * (a `https://*.vercel.app/**` wildcard covers previews), or magic links silently
 * fall back to the Supabase Site URL. See README → Deploy (`pnpm supabase:auth:config`).
 */
export function getSiteUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  const raw =
    env.NEXT_PUBLIC_SITE_URL ??
    env.VERCEL_PROJECT_PRODUCTION_URL ??
    env.VERCEL_URL ??
    env.NEXT_PUBLIC_APP_URL;

  return normalizeOrigin(raw);
}

/**
 * The origin of the *current request*, so a given deployment redirects back to
 * ITSELF (critical for PKCE: the `code_verifier` cookie is per-host — bouncing a
 * preview to production would fail the exchange). Falls back to `getSiteUrl()`
 * when forwarded headers are absent. Use for auth-callback / Stripe redirects.
 */
export function originFromRequest(request: Request): string {
  return originFromHeaders(request.headers) ?? getSiteUrl();
}

/**
 * Absolute URL of the OAuth / magic-link / password-reset callback route, with
 * the post-auth destination encoded in `next`. Pass this as Supabase's
 * `emailRedirectTo` / `redirectTo`. Called from Client Components, so it resolves
 * to the live origin via `getSiteUrl()`.
 */
export function authCallbackUrl(next = "/dashboard"): string {
  return `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
}
