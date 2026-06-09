import { NextResponse } from "next/server";

import { getSiteUrl } from "~/lib/site-url";
import { createClient } from "~/lib/supabase/server";

/**
 * CMS logout. The Payload admin has no login of its own — every `/admin` request
 * is authenticated from the **Supabase** session by the SSO bridge
 * (payload/auth/supabase-strategy.ts), and the local strategy (the `payload-token`
 * cookie) is disabled. So Payload's default logout — which only clears that token —
 * is a no-op here: the Supabase session survives and the SSO bridge immediately
 * re-authenticates, landing the user back on `/admin` still signed in.
 *
 * The admin's logout button is repointed here (admin.components.logout.Button →
 * payload/components/LogoutButton.tsx). This clears the Supabase session, which
 * is the single source of CMS auth, so the next `/admin` request authenticates as
 * null and the user is genuinely logged out of both the app and the CMS.
 *
 * Redirect is built from `getSiteUrl()` (not `request.url`): behind Vercel's proxy
 * `request.url` can carry the internal deployment host. Mirrors `/welcome`.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${getSiteUrl()}/sign-in`);
}
