import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { authCodeFunnelNext } from "~/lib/auth-redirect";
import { updateSession } from "~/lib/supabase/middleware";

// Routes that require a session (route groups like (app) don't appear in the URL).
// Defense-in-depth: the (app) layout also enforces a server-side session guard.
const PROTECTED_PREFIXES = [
  "/profile",
  "/chat",
  "/dashboard",
  "/reminders",
  "/notifications",
];
// Auth pages a signed-in user shouldn't see.
const AUTH_PREFIXES = ["/sign-in", "/sign-up", "/forgot-password"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Payload CMS owns its own auth/session under /admin and its REST API under
  // /cms-api. Never run the Supabase session/redirect logic on those paths.
  if (pathname.startsWith("/admin") || pathname.startsWith("/cms-api")) {
    return NextResponse.next();
  }

  // Safety net: if Supabase delivered the auth code to a path other than our
  // callback (it falls back to the project Site URL and lands on `/?code=…` when
  // the redirect allow-list doesn't match), funnel it to /auth/callback so the
  // session exchange still happens — preserving `code`/`token_hash` and setting
  // the post-auth destination.
  const funnelNext = authCodeFunnelNext(pathname, request.nextUrl.searchParams);
  if (funnelNext) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    url.searchParams.set("next", funnelNext);
    return NextResponse.redirect(url);
  }

  const { response, user } = await updateSession(request);

  if (!user && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (user && AUTH_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
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
