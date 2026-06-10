import { headers } from "next/headers";
import { NextResponse } from "next/server";
import config from "@payload-config";
import { getPayload } from "payload";
import { z } from "zod/v4";

import { createAdminClient } from "~/lib/supabase/admin";

/**
 * Promote an already-mirrored user to staff (CMS admin access). For brand-new
 * emails, "Users → Create New" still sends an invite via the collection hook;
 * this covers existing users by flagging `profiles.is_staff = true` (the
 * service-role client is the one writer allowed to touch that column).
 *
 * Authed via the Payload admin session (only staff have one). Keyed by the
 * Payload user doc id → its `supabaseUserId`.
 */
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  docId: z.string(),
  grant: z.boolean().default(true),
});

export async function POST(request: Request) {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await headers() });
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const doc = await payload
    .findByID({ collection: "users", id: parsed.data.docId, depth: 0 })
    .catch(() => null);
  const supabaseUserId = doc?.supabaseUserId as string | undefined;
  if (!supabaseUserId) {
    return NextResponse.json({ error: "User not linked" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ is_staff: parsed.data.grant })
    .eq("id", supabaseUserId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  return NextResponse.json({ ok: true, is_staff: parsed.data.grant });
}
