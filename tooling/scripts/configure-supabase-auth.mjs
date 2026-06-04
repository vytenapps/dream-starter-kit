#!/usr/bin/env node
// @ts-check
/**
 * One-shot: point your HOSTED Supabase project's Auth **Site URL** + **Redirect
 * URLs** at your deployed origin, so confirmation/magic-link/OAuth emails return
 * to the right host instead of falling back to the project default
 * (http://localhost:3000).
 *
 * WHY THIS EXISTS: Supabase validates every `redirect_to` against the project's
 * allow-list and falls back to the Site URL when it doesn't match. That list
 * lives in the *project*, not this repo — the Vercel↔Supabase integration does
 * NOT set it for a plain install — so no amount of app code can fix it. This
 * configures it in one command via the Management API.
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx SITE_URL=https://your-app.vercel.app \
 *     pnpm supabase:auth:config
 *
 * Inputs (env vars; a repo `.env` is auto-loaded by the `pnpm` script):
 *   SUPABASE_ACCESS_TOKEN  (required) Personal access token —
 *                          https://supabase.com/dashboard/account/tokens
 *   SITE_URL               (required) Your canonical deployed origin, e.g.
 *                          https://dream-starter-kit003.vercel.app (or custom domain).
 *                          Falls back to NEXT_PUBLIC_SITE_URL.
 *   SUPABASE_PROJECT_REF   (optional) Else parsed from NEXT_PUBLIC_SUPABASE_URL /
 *                          SUPABASE_URL (the `<ref>` in https://<ref>.supabase.co).
 *   REDIRECT_URLS          (optional) Comma-separated override for the allow-list.
 *                          Default covers prod + Vercel previews + localhost + native.
 *   EXPO_PUBLIC_AUTH_SCHEME (optional) Native deep-link scheme (default "dreamstarter").
 *
 * With no SUPABASE_ACCESS_TOKEN it prints the exact values to paste into
 * Authentication → URL Configuration, then exits — so it doubles as a "show me
 * the settings" helper.
 */

const MANAGEMENT_API = "https://api.supabase.com";

/** @param {string} url */
function stripTrailingSlash(url) {
  return url.replace(/\/+$/, "");
}

/** Parse the `<ref>` out of https://<ref>.supabase.co (or .supabase.in). */
function refFromSupabaseUrl(url) {
  if (!url) return null;
  try {
    const { hostname } = new URL(url);
    const m = /^([a-z0-9]{20})\.supabase\.(co|in)$/i.exec(hostname);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const siteUrlRaw = (
  process.env.SITE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  ""
).trim();
const projectRef =
  process.env.SUPABASE_PROJECT_REF?.trim() ||
  refFromSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "") ||
  refFromSupabaseUrl(process.env.SUPABASE_URL ?? "");
const scheme = (process.env.EXPO_PUBLIC_AUTH_SCHEME ?? "dreamstarter").trim();

if (!siteUrlRaw) {
  fail(
    "Missing SITE_URL. Set it to your deployed origin, e.g.\n" +
      "  SITE_URL=https://dream-starter-kit003.vercel.app pnpm supabase:auth:config",
  );
}
const siteUrl = stripTrailingSlash(siteUrlRaw);
if (!/^https?:\/\//.test(siteUrl)) {
  fail(`SITE_URL must include a scheme (got "${siteUrl}").`);
}

// Default allow-list: the production origin, Vercel previews (one wildcard covers
// branch + hash deploys), local dev, and the native deep link. `/**` matches any
// path + query so /auth/callback?next=… round-trips.
const redirectUrls = (
  process.env.REDIRECT_URLS
    ? process.env.REDIRECT_URLS.split(",")
    : [
        `${siteUrl}/**`,
        "https://*.vercel.app/**",
        "http://localhost:3000/**",
        `${scheme}://auth-callback`,
      ]
)
  .map((u) => u.trim())
  .filter(Boolean);
const uriAllowList = [...new Set(redirectUrls)].join(",");

console.log("\nSupabase Auth URL configuration");
console.log("────────────────────────────────");
console.log(`  Project ref : ${projectRef ?? "(unknown)"}`);
console.log(`  Site URL    : ${siteUrl}`);
console.log(`  Redirect URLs:`);
for (const u of redirectUrls) console.log(`    • ${u}`);
console.log("");

if (!accessToken) {
  console.log(
    "No SUPABASE_ACCESS_TOKEN set — not applying. Paste the values above into\n" +
      "  Dashboard → Authentication → URL Configuration\n" +
      "or re-run with a token to apply automatically:\n" +
      "  https://supabase.com/dashboard/account/tokens\n",
  );
  process.exit(1);
}
if (!projectRef) {
  fail(
    "Could not determine the project ref. Set SUPABASE_PROJECT_REF, or ensure\n" +
      "NEXT_PUBLIC_SUPABASE_URL points at your hosted project (https://<ref>.supabase.co).",
  );
}

const endpoint = `${MANAGEMENT_API}/v1/projects/${projectRef}/config/auth`;
const res = await fetch(endpoint, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ site_url: siteUrl, uri_allow_list: uriAllowList }),
});

if (!res.ok) {
  const body = await res.text().catch(() => "");
  fail(
    `Management API returned ${res.status} ${res.statusText}.\n${body}\n` +
      "Check that the access token is valid and has access to this project.",
  );
}

console.log("✓ Updated. New deploys/previews/localhost now complete auth on their own origin.\n");
