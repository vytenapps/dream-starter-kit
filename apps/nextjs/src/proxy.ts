import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { cmsConfigStatus, cmsNotConfiguredMessage } from "~/lib/cms/env-status";
import { updateSession } from "~/lib/supabase/middleware";

// Routes that require a session (route groups like (app) don't appear in the URL).
// Defense-in-depth: the (app) layout also enforces a server-side session guard.
// "/a" covers the app home AND every extension's default mount (/a/<slug>/…);
// extension mount overrides in the authed area must be listed individually
// (e.g. "/billing").
const PROTECTED_PREFIXES = ["/profile", "/a", "/billing"];
// Auth pages a signed-in user shouldn't see.
const AUTH_PREFIXES = ["/sign-in", "/sign-up", "/forgot-password"];

// Segment-boundary prefix match: "/a" must protect "/a" and "/a/…" but NOT
// "/about" (bare startsWith would).
const matchesPrefix = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The remote MCP server (packages/mcp) authenticates by OAuth bearer token /
  // dynamic client registration — NOT the Supabase session cookie — so these
  // endpoints bypass session refresh entirely (refreshing would rewrite
  // Set-Cookie on responses MCP clients don't carry cookies for). NOTE:
  // /oauth/authorize and /oauth/callback are deliberately excluded — they DO
  // read the Supabase session to identify the signing-in staff user.
  if (
    pathname === "/mcp" ||
    pathname.startsWith("/mcp/") ||
    pathname.startsWith("/.well-known/oauth-") ||
    pathname === "/oauth/register" ||
    pathname === "/oauth/token"
  ) {
    return NextResponse.next();
  }

  const { response, user, supabase } = await updateSession(request);

  // Payload CMS (/admin UI + /cms-api REST) authenticates from the Supabase session
  // via the SSO bridge (payload/auth/supabase-strategy.ts). The session is refreshed
  // above; here we gate /admin so only staff app users reach Payload's (login-less)
  // admin — anonymous users go to sign-in, non-staff back to the app.
  if (pathname.startsWith("/admin") || pathname.startsWith("/cms-api")) {
    // Without credentials (explicit OR derivable from the Supabase env) the
    // CMS can't even init — Payload throws "missing secret key" and the
    // founder gets an opaque 500 digest. Answer with what's missing instead
    // (names only — safe for anonymous eyes, and exactly what a founder
    // debugging a fresh deploy needs).
    const cmsConfig = cmsConfigStatus();
    if (!cmsConfig.configured) {
      return new NextResponse(cmsNotConfiguredMessage(cmsConfig.missing), {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    if (pathname.startsWith("/admin")) {
      if (!user) {
        const url = request.nextUrl.clone();
        url.pathname = "/sign-in";
        url.search = "";
        url.searchParams.set("redirectTo", pathname);
        return NextResponse.redirect(url);
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_staff")
        .eq("id", user.id)
        .single();
      if (!profile?.is_staff) {
        const url = request.nextUrl.clone();
        url.pathname = "/a";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
    return response;
  }

  if (!user && PROTECTED_PREFIXES.some((p) => matchesPrefix(pathname, p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (user && AUTH_PREFIXES.some((p) => matchesPrefix(pathname, p))) {
    const url = request.nextUrl.clone();
    // /welcome routes by role: staff into the CMS, everyone else to /a
    // — same destination logic as a fresh sign-in.
    url.pathname = "/welcome";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
