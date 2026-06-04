import type { EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { originFromRequest } from "~/lib/site-url";
import { createClient } from "~/lib/supabase/server";

/**
 * Only allow internal absolute paths as the post-auth destination, so a crafted
 * `?next=` can't turn the callback into an open redirect. `//evil.com` and
 * `https://evil.com` are rejected; legitimate values are app paths like
 * `/dashboard`.
 */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//")
    ? raw
    : "/dashboard";
}

/**
 * OAuth + magic-link + email-confirmation + password-reset callback: turn the
 * URL token into a session cookie, then redirect to `next`. Handles both flavors
 * Supabase can send — PKCE (`?code=`, the default here) and OTP token-hash
 * (`?token_hash=&type=`, used by the older email templates) — so it works
 * whichever the project is configured for.
 *
 * Redirects are built from `originFromRequest()` — the public host from the
 * forwarded headers — so the user stays on the SAME deployment they arrived on.
 * This matters for PKCE: the `code_verifier` cookie was set on this host during
 * sign-up, so the exchange (and the post-exchange redirect) must stay here, not
 * bounce to a fixed production URL.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));
  const siteUrl = originFromRequest(request);

  if (code || tokenHash) {
    const supabase = await createClient();
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({
          type: type ?? "email",
          token_hash: tokenHash ?? "",
        });
    if (!error) {
      return NextResponse.redirect(`${siteUrl}${next}`);
    }
  }

  return NextResponse.redirect(`${siteUrl}/sign-in?error=auth_callback`);
}
