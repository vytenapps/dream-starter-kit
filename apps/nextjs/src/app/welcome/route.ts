import { NextResponse } from "next/server";

import { getSiteUrl } from "~/lib/site-url";
import { createClient } from "~/lib/supabase/server";

/**
 * Post-signup landing. Routes the FIRST account — the founder, flagged
 * `profiles.is_staff` by the `handle_new_user` trigger — into the CMS setup flow
 * so demo content is seeded behind the shadcn progress bar IMMEDIATELY after the
 * account is created, before they reach `/admin`. Everyone else goes straight to
 * `/dashboard`.
 *
 * Reached as a hard navigation right after password sign-up, and as the OAuth
 * callback `next` for the sign-up page. Idempotent: returning/non-staff users
 * fall through to `/dashboard`, and `/cms-setup` itself no-ops once the CMS is
 * already seeded — so a second visit never re-runs the seed.
 *
 * Redirects are built from `getSiteUrl()` (not `request.url`): behind Vercel's
 * proxy `request.url` can carry the internal deployment host. Mirrors
 * `/auth/callback`.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const siteUrl = getSiteUrl();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${siteUrl}/sign-in`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_staff")
    .eq("id", user.id)
    .single();

  const dest = profile?.is_staff ? "/cms-setup" : "/dashboard";
  return NextResponse.redirect(`${siteUrl}${dest}`);
}
