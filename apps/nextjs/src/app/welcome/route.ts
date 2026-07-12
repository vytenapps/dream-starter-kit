import { NextResponse } from "next/server";

import { reconcileAnonByEmail } from "~/lib/auth/merge-anon";
import { ensureCmsUser, ensureFreeTag } from "~/lib/cms/mirror-user";
import { getPayloadClient } from "~/lib/cms/payload-client";
import { isCmsSeeded } from "~/lib/cms/seed-status";
import { ensureDbProvisioned } from "~/lib/db/bootstrap-runner";
import { getSiteUrl } from "~/lib/site-url";
import { createAdminClient } from "~/lib/supabase/admin";
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

/**
 * Shown (503 + auto-refresh) while the database behind a brand-new deploy is
 * still being provisioned. The page re-requests /welcome every few seconds;
 * combined with `ensureDbProvisioned` below, the founder's sign-up completes
 * by itself as soon as the database accepts connections — no manual steps, no
 * dead-end error page.
 */
function databaseNotReadyResponse(): NextResponse {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <meta http-equiv="refresh" content="8" />
    <title>Finishing setup…</title>
    <style>
      body { font: 16px/1.6 system-ui, sans-serif; margin: 0; min-height: 100vh;
             display: flex; align-items: center; justify-content: center;
             background: #fafafa; color: #171717; }
      main { max-width: 26rem; padding: 2rem; text-align: center; }
      h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
      p { margin: .5rem 0; color: #525252; }
      .spin { width: 1.5rem; height: 1.5rem; margin: 0 auto 1rem;
              border: 2px solid #d4d4d4; border-top-color: #171717;
              border-radius: 50%; animation: s 1s linear infinite; }
      @keyframes s { to { transform: rotate(360deg); } }
      a { color: inherit; }
      @media (prefers-color-scheme: dark) {
        body { background: #0a0a0a; color: #fafafa; }
        p { color: #a3a3a3; }
        .spin { border-color: #404040; border-top-color: #fafafa; }
      }
    </style>
  </head>
  <body>
    <main>
      <div class="spin" aria-hidden="true"></div>
      <h1>Finishing setup…</h1>
      <p>Your database is still being provisioned. This page retries
         automatically — a fresh project usually takes under a minute.</p>
      <p>If it doesn't resolve, check <a href="/api/health/db">/api/health/db</a>
         and the README's Deploy section.</p>
    </main>
  </body>
</html>`;
  return new NextResponse(html, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Retry-After": "8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET() {
  const siteUrl = getSiteUrl();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${siteUrl}/sign-in`);
  }

  // A brand-new deploy can reach here BEFORE the runtime DB bootstrap has
  // managed to provision the database (a just-created Supabase project may
  // reject the boot-time connection attempts). This is the founder's first
  // navigation after sign-up — exactly the moment provisioning must exist —
  // so retry it now (single-flight + cooldown; a healthy instance returns
  // immediately). Best-effort: the profiles probe below decides what renders.
  try {
    await ensureDbProvisioned();
  } catch (error) {
    console.warn("[welcome] provisioning retry failed", error);
  }

  // Mirror the user into the Payload Users collection (all users) and ensure a
  // default "Free" tag. Best-effort — never blocks the redirect.
  await ensureCmsUser({
    id: user.id,
    email: user.email,
    name:
      (user.user_metadata.display_name as string | undefined) ??
      (user.user_metadata.name as string | undefined),
    metadata: user.user_metadata,
  });
  await ensureFreeTag(user.id);

  // Reconciliation safety net: a paid anonymous buyer who never confirmed and
  // then signed up fresh would otherwise strand their subscription on the dead
  // anon account. If this (now permanent) user hasn't transacted yet, merge any
  // orphaned anonymous users that carry their email. Cheap guard avoids the
  // listUsers scan for accounts that already have billing. Best-effort.
  if (!user.is_anonymous && user.email) {
    try {
      const { data: customer } = await supabase
        .from("ext_billing_customers")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!customer) {
        await reconcileAnonByEmail(createAdminClient(), user.id, user.email);
      }
    } catch (e) {
      console.warn("[welcome] anon reconciliation failed", e);
    }
  }

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
    // Auto-refreshing holding page: each refresh re-enters this handler, whose
    // `ensureDbProvisioned` keeps retrying until the database comes up — the
    // founder's first sign-in completes on its own instead of dead-ending.
    return databaseNotReadyResponse();
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
    const payload = await getPayloadClient();
    if (await isCmsSeeded(payload)) dest = "/admin";
  } catch (error) {
    console.warn(
      "[welcome] CMS seeded check failed — routing to /cms-setup",
      error,
    );
  }
  return NextResponse.redirect(`${siteUrl}${dest}`);
}
