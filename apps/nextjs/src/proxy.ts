import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { cmsConfigStatus, cmsNotConfiguredMessage } from "~/lib/cms/env-status";
import { updateSession } from "~/lib/supabase/middleware";

// Routes that require a session (route groups like (app) don't appear in the URL).
// Defense-in-depth: the (app) layout also enforces a server-side session guard.
// "/x" covers every extension's default mount (/x/<slug>/…); extension mount
// overrides in the authed area must be listed individually (e.g. "/billing").
const PROTECTED_PREFIXES = [
  "/profile",
  "/chat",
  "/a",
  "/reminders",
  "/billing",
  "/x",
];
// Auth pages a signed-in user shouldn't see.
const AUTH_PREFIXES = ["/sign-in", "/sign-up", "/forgot-password"];

// Segment-boundary prefix match: "/a" must protect "/a" and "/a/…" but NOT
// "/about" (bare startsWith would).
const matchesPrefix = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
