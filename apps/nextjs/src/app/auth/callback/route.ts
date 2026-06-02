import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createClient } from "~/lib/supabase/server";

/**
 * OAuth + magic-link + password-reset callback: exchange the `code` for a
 * session cookie, then redirect to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/profile";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_callback`);
}
