import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

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

  const { response, user, supabase } = await updateSession(request);

  // Payload CMS (/admin UI + /cms-api REST) authenticates from the Supabase session
  // via the SSO bridge (payload/auth/supabase-strategy.ts). The session is refreshed
  // above; here we gate /admin so only staff app users reach Payload's (login-less)
  // admin — anonymous users go to sign-in, non-staff back to the app.
  if (pathname.startsWith("/admin") || pathname.startsWith("/cms-api")) {
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
        url.pathname = "/dashboard";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
    return response;
  }

  if (!user && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (user && AUTH_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    // /welcome routes by role: staff into the CMS, everyone else to /dashboard
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
