import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { updateSession } from "~/lib/supabase/middleware";

// Routes that require a session (route groups like (app) don't appear in the URL).
// Defense-in-depth: the (app) layout also enforces a server-side session guard.
const PROTECTED_PREFIXES = [
  "/profile",
  "/projects",
  "/chat",
  "/dashboard",
  "/reminders",
  "/notifications",
];
// Auth pages a signed-in user shouldn't see.
const AUTH_PREFIXES = ["/sign-in", "/sign-up", "/forgot-password"];

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

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
