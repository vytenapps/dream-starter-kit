import "server-only";

import config from "@payload-config";
import { getPayload } from "payload";

import { createAdminClient } from "~/lib/supabase/admin";

/**
 * Mirror a Supabase user into the Payload `users` collection so the admin Users
 * page lists ALL app users (not just staff). Idempotent: no-ops if a row already
 * exists for this `supabaseUserId`.
 *
 * Providing `supabaseUserId` makes the staff-invite hook (payload/hooks/invite-
 * user.ts) skip — so mirroring a normal user does NOT send an invite or flag
 * `is_staff`. Admin login is still gated on `profiles.is_staff` by the SSO
 * strategy, so a mirrored non-staff row cannot sign in to /admin.
 *
 * Best-effort: any failure (CMS down, not migrated) is swallowed so it never
 * blocks the auth/redirect flow that calls it.
 */
export async function ensureCmsUser(user: {
  id: string;
  email?: string | null;
  name?: string | null;
}): Promise<void> {
  try {
    const payload = await getPayload({ config });
    const existing = await payload.find({
      collection: "users",
      where: { supabaseUserId: { equals: user.id } },
      limit: 1,
      depth: 0,
    });
    if (existing.totalDocs === 0) {
      await payload.create({
        collection: "users",
        data: {
          supabaseUserId: user.id,
          email: user.email ?? `${user.id}@users.noreply.local`,
          name: user.name ?? undefined,
          role: "editor",
        },
        overrideAccess: true,
      });
    }
  } catch {
    // Non-fatal — the SSO bridge JIT-provisions staff anyway, and a backfill
    // script can catch up the rest.
  }
}

/**
 * Ensure a "Free" plan tag is assigned to a user who has no plan tag yet.
 * Paid plan tags are added (and "Free" removed) by the Stripe webhook. Uses the
 * service-role client because tag tables are not user-writable by design.
 */
export async function ensureFreeTag(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("user_tags")
      .select("id")
      .eq("user_id", userId)
      .limit(1);
    if (existing && existing.length > 0) return; // already tagged (free or plan)

    const { data: tag } = await admin
      .from("tags")
      .upsert({ name: "Free", is_system: true }, { onConflict: "name" })
      .select("id")
      .maybeSingle();
    if (!tag?.id) return;
    await admin
      .from("user_tags")
      .upsert(
        { user_id: userId, tag_id: tag.id },
        { onConflict: "user_id,tag_id" },
      );
  } catch {
    // Non-fatal.
  }
}
