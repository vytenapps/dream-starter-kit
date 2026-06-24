import { NextResponse } from "next/server";
import { z } from "zod/v4";

import { findUserIdByEmail, mergeAnonUser } from "~/lib/auth/merge-anon";
import { authCallbackUrl } from "~/lib/site-url";
import { createAdminClient } from "~/lib/supabase/admin";
import { createClient } from "~/lib/supabase/server";

const schema = z.object({ email: z.email() });

/**
 * Merge an anonymous buyer's data into the existing account that owns the
 * checkout email (the anon user can't claim an in-use email). Caller must be the
 * anonymous user; we reassign their billing/favorites to the real account,
 * delete the anon user, and send a sign-in link to the email. See
 * lib/auth/merge-anon.ts.
 */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const { email } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  // Only an anonymous user merges into someone else; a real user keeps theirs.
  if (!user.is_anonymous) {
    return NextResponse.json({ ok: true, merged: false });
  }

  const admin = createAdminClient();
  const realId = await findUserIdByEmail(admin, email);
  if (!realId || realId === user.id) {
    // Email isn't actually taken — nothing to merge.
    return NextResponse.json({ ok: true, merged: false });
  }

  await mergeAnonUser(admin, user.id, realId);

  // Best-effort: email the existing account a magic link so they can sign in and
  // see the just-purchased subscription. (Their anon session is now invalid.)
  await supabase.auth
    .signInWithOtp({
      email,
      options: { emailRedirectTo: authCallbackUrl("/a") },
    })
    .catch(() => undefined);

  return NextResponse.json({ ok: true, merged: true });
}
