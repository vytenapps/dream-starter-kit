import { NextResponse } from "next/server";

import { ensureCmsUser, ensureFreeTag } from "~/lib/cms/mirror-user";
import { getSiteUrl } from "~/lib/site-url";
import { createClient } from "~/lib/supabase/server";

/**
 * Post-signup landing. Routes the FIRST account — the founder, flagged
 * `profiles.is_staff` by the `handle_new_user` trigger — into the CMS setup flow
 * so demo content is seeded behind the shadcn progress bar IMMEDIATELY after the
 * account is created, before they reach `/admin`. Everyone else goes straight to
 * `/a`.
 *
 * Reached as a hard navigation right after password sign-up, and as the OAuth
 * callback `next` for the sign-up page. Idempotent: returning/non-staff users
 * fall through to `/a`, and `/cms-setup` itself no-ops once the CMS is
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

  // Mirror the user into the Payload Users collection (all users) and ensure a
  // default "Free" tag. Best-effort — never blocks the redirect.
  await ensureCmsUser({
    id: user.id,
    email: user.email,
    name:
      (user.user_metadata.display_name as string | undefined) ??
      (user.user_metadata.name as string | undefined),
  });
  await ensureFreeTag(user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_staff")
    .eq("id", user.id)
    .single();

  const dest = profile?.is_staff ? "/cms-setup" : "/a";
  return NextResponse.redirect(`${siteUrl}${dest}`);
}
