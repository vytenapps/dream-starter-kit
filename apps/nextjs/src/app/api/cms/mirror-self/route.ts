import { NextResponse } from "next/server";

import { slidingWindow } from "@acme/config";

import { ensureCmsUser, ensureFreeTag } from "~/lib/cms/mirror-user";
import { createClient } from "~/lib/supabase/server";

// Per-user budget: each call runs a Payload find + up to three service-role tag
// queries, so an unbounded caller could hammer the small serverless pool. In
// memory per instance, same trade-off as the extension dispatcher.
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const hitsByUser = new Map<string, number[]>();

function rateLimit(userId: string): boolean {
  const now = Date.now();
  const { allowed, hits } = slidingWindow(
    hitsByUser.get(userId) ?? [],
    now,
    RATE_WINDOW_MS,
    RATE_LIMIT,
  );
  hitsByUser.set(userId, hits);
  return allowed;
}

/**
 * Mirror the CURRENT Supabase session user into the Payload `users` collection
 * (and ensure a default tag). Idempotent and best-effort.
 *
 * Why this exists: `ensureCmsUser` otherwise only runs on the two server auth
 * navigations (`/welcome`, `/auth/callback`). Several flows establish a session
 * CLIENT-SIDE and never hit either — most notably the paywall guest checkout
 * (paywall-modal.tsx): it creates the account via /api/ext/billing/guest-account,
 * receives a one-time login token, calls `verifyOtp` to sign the buyer in, then
 * unlocks inline with `onSuccess()`. Without this endpoint those buyers (members,
 * not staff — so the SSO bridge never provisions them either) would be missing
 * from the admin Users page until they happened to pass through /welcome. The
 * client calls this right after the session is established. See lib/cms/mirror-
 * user.ts and the (app) layout backstop.
 *
 * Authenticated by the caller's OWN Supabase session — it only ever mirrors the
 * authenticated user, so there is nothing to authorize beyond "is signed in".
 */
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Anonymous sessions are real auth.users under the anon-first identity model,
  // but they must NOT be mirrored: cms.users is for real members/staff, and a
  // mirrored anon becomes a permanent ghost Users row that nothing cleans up
  // after the anon is merged + deleted on conversion. Mirroring happens on the
  // conversion paths (/confirm-email, /welcome, /auth/callback) instead.
  if (user.is_anonymous) {
    return NextResponse.json({ ok: true, skipped: "anonymous" });
  }

  if (!rateLimit(user.id)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again shortly." },
      { status: 429 },
    );
  }

  await ensureCmsUser({
    id: user.id,
    email: user.email,
    name:
      (user.user_metadata.display_name as string | undefined) ??
      (user.user_metadata.name as string | undefined),
    metadata: user.user_metadata,
  });
  await ensureFreeTag(user.id);

  return NextResponse.json({ ok: true });
}
