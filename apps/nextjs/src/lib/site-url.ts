import { env } from "~/env";

/**
 * The public origin of the web app, resolved WITHOUT relying on `window` so it
 * is correct in Client Components, Server Components, Route Handlers, and during
 * SSR. This is the single source of truth for every absolute URL the app emits
 * (auth email/OAuth redirects, Stripe return URLs, OG `metadataBase`, sitemap).
 *
 * Resolution order (first non-empty wins):
 *   1. NEXT_PUBLIC_SITE_URL                      — explicit override; set this to
 *      your custom domain (e.g. https://app.example.com).
 *   2. NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL — the project's STABLE production
 *      domain. Auto-injected by Vercel for Next.js, on every deployment (incl.
 *      previews), so previews redirect auth back to production — which means you
 *      only have to allow-list ONE URL in Supabase.
 *   3. NEXT_PUBLIC_VERCEL_URL                    — the per-deployment URL. Defensive
 *      fallback (also auto-injected by Vercel).
 *   4. NEXT_PUBLIC_APP_URL                       — local/dev default
 *      (http://localhost:3000).
 *
 * The Vercel values arrive without a scheme (e.g. `my-app.vercel.app`), so a
 * scheme is added when missing. The result never has a trailing slash.
 *
 * NOTE: this only controls the URLs the *app* generates. Supabase still validates
 * every redirect against its own allow-list — set the project's **Site URL** and
 * **Redirect URLs** (Authentication → URL Configuration) to your deployed origin,
 * or magic links silently fall back to the Supabase Site URL. See README → Deploy.
 */
export function getSiteUrl(): string {
  const raw =
    env.NEXT_PUBLIC_SITE_URL ??
    env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ??
    env.NEXT_PUBLIC_VERCEL_URL ??
    env.NEXT_PUBLIC_APP_URL;

  const withScheme = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, "");
}

/**
 * Absolute URL of the OAuth / magic-link / password-reset callback route, with
 * the post-auth destination encoded in `next`. Pass this as Supabase's
 * `emailRedirectTo` / `redirectTo`.
 */
export function authCallbackUrl(next = "/a"): string {
  return `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
}
