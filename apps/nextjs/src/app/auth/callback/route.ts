import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { ensureCmsUser, ensureFreeTag } from "~/lib/cms/mirror-user";
import { getSiteUrl } from "~/lib/site-url";
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
 * OAuth + magic-link + password-reset callback: exchange the `code` for a
 * session cookie, then redirect to `next`.
 *
 * Redirects are built from `getSiteUrl()` (not the request origin): behind
 * Vercel's proxy `request.url` can carry the internal deployment host, which
 * would bounce the user to the wrong URL after a successful exchange.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  const siteUrl = getSiteUrl();

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Mirror into Payload Users + ensure a default tag (best-effort).
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await ensureCmsUser({
          id: user.id,
          email: user.email,
          name:
            (user.user_metadata.display_name as string | undefined) ??
            (user.user_metadata.name as string | undefined),
        });
        await ensureFreeTag(user.id);
      }
      return NextResponse.redirect(`${siteUrl}${next}`);
    }
  }

  return NextResponse.redirect(`${siteUrl}/sign-in?error=auth_callback`);
}
