import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  issueAuthorizationCode,
  OAuthError,
  OAuthRedirectError,
  validateAuthorizeRequest,
} from "@acme/mcp";

import { getMcpStoreClient, isMcpEnabled } from "~/lib/mcp/config";
import { createClient } from "~/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OAuth 2.1 authorization endpoint. Reuses the app's existing Supabase
 * /sign-in: an unauthenticated user is bounced there with this URL as
 * `redirectTo`, then returns here authenticated. Staff (profiles.is_staff) get
 * an authorization code; everyone else is denied. The act of signing in IS the
 * consent — there is no separate approval screen.
 */
export async function GET(req: NextRequest) {
  if (!isMcpEnabled()) return new NextResponse("Not found", { status: 404 });

  const params = req.nextUrl.searchParams;
  const store = getMcpStoreClient();

  let validated;
  try {
    validated = await validateAuthorizeRequest(store, params);
  } catch (err) {
    if (err instanceof OAuthRedirectError) {
      return NextResponse.redirect(err.toRedirectUrl());
    }
    if (err instanceof OAuthError) {
      // Bad client_id / redirect_uri — unsafe to redirect, so show the error.
      return new NextResponse(`${err.error}: ${err.description}`, {
        status: err.status,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    throw err;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Reuse the existing sign-in flow; come back to this exact authorize URL.
    const signIn = new URL("/sign-in", req.nextUrl.origin);
    signIn.searchParams.set(
      "redirectTo",
      `/oauth/authorize?${params.toString()}`,
    );
    return NextResponse.redirect(signIn);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_staff")
    .eq("id", user.id)
    .single();

  if (!profile?.is_staff) {
    // Authenticated but not staff: deny via the OAuth error redirect.
    const denied = new OAuthRedirectError(
      validated.redirectUri,
      "access_denied",
      "This account does not have access to the MCP server (staff only).",
      validated.state,
    );
    return NextResponse.redirect(denied.toRedirectUrl());
  }

  const redirectUrl = await issueAuthorizationCode(store, validated, user.id);
  return NextResponse.redirect(redirectUrl);
}
