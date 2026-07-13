import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod/v4";

import { getPayloadClient } from "~/lib/cms/payload-client";
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
  const payload = await getPayloadClient();
  const { user } = await payload.auth({ headers: await headers() });
  // The SSO bridge only authenticates staff, but check the role explicitly
  // for defense in depth (only admins/editors may grant or revoke staff).
  if (!user?.roles.some((r) => ["admin", "editor"].includes(r)))
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

  // Keep the CMS row's roles in step with the Supabase-side grant: granting
  // adds `editor` (unless they already hold a staff role); revoking strips
  // the staff roles back to a plain member.
  const roles = doc?.roles ?? [];
  const staff = ["admin", "editor", "author"];
  const nextRoles = parsed.data.grant
    ? roles.some((r) => staff.includes(r))
      ? roles
      : [...roles, "editor" as const]
    : roles.filter((r) => !staff.includes(r));
  await payload.update({
    collection: "users",
    id: parsed.data.docId,
    data: { roles: nextRoles.length > 0 ? nextRoles : ["member"] },
    overrideAccess: true,
  });

  return NextResponse.json({ ok: true, is_staff: parsed.data.grant });
}
