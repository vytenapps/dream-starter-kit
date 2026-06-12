import { NextResponse } from "next/server";
import config from "@payload-config";
import { getPayload } from "payload";

import { ensureCmsUser, ensureFreeTag } from "~/lib/cms/mirror-user";
import { isCmsSeeded } from "~/lib/cms/seed-status";
import { getSiteUrl } from "~/lib/site-url";
import { createClient } from "~/lib/supabase/server";

/**
 * Post-auth landing — routes by role. Staff land in the CMS: the FIRST staff
 * login ever (the founder, flagged `profiles.is_staff` by the
 * `handle_new_user` trigger) goes through the CMS setup flow so demo content
 * is seeded behind the shadcn progress bar IMMEDIATELY after the account is
 * created; once the CMS is seeded, staff go STRAIGHT to `/admin` — the
 * `/cms-setup` progress screen is a one-time founder experience, never shown
 * on subsequent sign-ins or to later staff accounts. Everyone else goes to
 * `/a`.
 *
 * Reached as a hard navigation right after password sign-up/sign-in, and as
 * the OAuth callback `next` for the auth pages. Idempotent either way:
 * `/cms-setup` itself also no-ops (and forwards to `/admin`) if it's ever
 * reached with the CMS already seeded.
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

  // maybeSingle: zero rows is NOT an error (a missing profile row just routes
  // to /a) — but a query failure (e.g. the profiles table doesn't exist
  // because the runtime DB bootstrap failed) must NOT silently misroute the
  // founder; surface it instead.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_staff")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error(
      "[welcome] profiles lookup failed — database likely not provisioned",
      error,
    );
    return new NextResponse(
      "Database not ready: the profiles table is missing or unreachable.\n" +
        "Check /api/health/db for the runtime DB bootstrap status, then see " +
        "the README's Deploy section (apply the schema) and your server logs.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  if (!profile?.is_staff) {
    return NextResponse.redirect(`${siteUrl}/a`);
  }

  // Staff: only the very first staff login should see the seed screen. If the
  // CMS is already seeded, skip /cms-setup entirely. If the seeded check fails
  // (CMS unconfigured, DB unreachable), fall back to /cms-setup — it surfaces
  // a structured, founder-readable error instead of /admin's opaque digest,
  // and its seed POST is idempotent so a stale routing can never double-seed.
  let dest = "/cms-setup";
  try {
    const payload = await getPayload({ config });
    if (await isCmsSeeded(payload)) dest = "/admin";
  } catch (error) {
    console.warn(
      "[welcome] CMS seeded check failed — routing to /cms-setup",
      error,
    );
  }
  return NextResponse.redirect(`${siteUrl}${dest}`);
}
