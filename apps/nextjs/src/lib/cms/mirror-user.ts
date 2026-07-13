import "server-only";

import { createAdminClient } from "~/lib/supabase/admin";
import { withCmsSchemaHeal } from "./ensure-schema";
import { getPayloadClient } from "./payload-client";

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
  /**
   * Supabase `user_metadata`. The billing guest-account route + Stripe webhook
   * stamp the wallet identity here (phone, billing_postal_code, billing_address)
   * so this one-way Supabase -> Payload mirror can populate the cms.users
   * contact/billing fields (docs/ARCHITECTURE.md: profiles is the RLS source for
   * security-critical state incl. phone; cms.users mirrors + holds the address).
   */
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const payload = await getPayloadClient();

    // Map wallet-captured contact/billing from user_metadata onto the cms.users
    // shape (its `address` group has no `line1/line2/state`, so fold them in).
    const meta = user.metadata ?? {};
    const str = (v: unknown) =>
      typeof v === "string" && v.trim() ? v.trim() : undefined;
    const phone = str(meta.phone);
    const rawAddr = (meta.billing_address ?? null) as Record<
      string,
      unknown
    > | null;
    const postalCode =
      str(rawAddr?.postal_code) ?? str(meta.billing_postal_code);
    // Stripe addresses have line1 + line2; the cms.users address has a single
    // `street`, so fold both in rather than dropping line2.
    const street =
      [str(rawAddr?.line1), str(rawAddr?.line2)].filter(Boolean).join(", ") ||
      undefined;
    const address =
      rawAddr || postalCode
        ? {
            street,
            city: str(rawAddr?.city),
            region: str(rawAddr?.state),
            postalCode,
            country: str(rawAddr?.country),
          }
        : undefined;

    // `trash: true` includes soft-deleted rows: a member an admin moved to the
    // Trash must stay deleted (restore happens from the admin Trash view), not
    // be resurrected — and re-creating would trip the unique supabaseUserId
    // constraint and get masked by the catch below.
    // First cms.* query of the post-signup /welcome flow — self-heals a wiped
    // cms schema (lib/cms/ensure-schema.ts) so the founder's first login lands
    // on a working /cms-setup instead of a 500.
    const existing = await withCmsSchemaHeal(payload, () =>
      payload.find({
        collection: "users",
        where: { supabaseUserId: { equals: user.id } },
        limit: 1,
        depth: 0,
        trash: true,
      }),
    );
    if (existing.totalDocs === 0) {
      // A staff-flagged profile without a CMS row at mirror time is the
      // FOUNDER (the first signup, auto-flagged is_staff) — provision them as
      // the full CMS admin. Invited staff already have a row (the invite hook
      // created it with `editor`), so this path never demotes/promotes them.
      let isStaff = false;
      try {
        const { data: profile } = await createAdminClient()
          .from("profiles")
          .select("is_staff")
          .eq("id", user.id)
          .maybeSingle();
        isStaff = Boolean(profile?.is_staff);
      } catch {
        // Service key unavailable — mirror as a plain member; the SSO bridge
        // still grants a staff role on their first /admin visit.
      }
      await payload.create({
        collection: "users",
        data: {
          supabaseUserId: user.id,
          email: user.email ?? `${user.id}@users.noreply.local`,
          name: user.name ?? undefined,
          roles: isStaff ? ["admin"] : ["member"],
          ...(phone ? { phone } : {}),
          ...(address ? { address } : {}),
        },
        overrideAccess: true,
      });
      return;
    }

    // Row exists: backfill the wallet contact/billing onto EMPTY fields only —
    // never clobber a value a staff member or the user edited.
    const doc = existing.docs[0] as {
      id: string | number;
      phone?: string | null;
      address?: Record<string, string | null | undefined> | null;
    };
    const data: Record<string, unknown> = {};
    if (phone && !str(doc.phone)) data.phone = phone;
    if (address) {
      const cur = doc.address ?? {};
      const merged: Record<string, string> = {};
      for (const [k, v] of Object.entries(address)) {
        if (v && !str(cur[k])) merged[k] = v;
      }
      if (Object.keys(merged).length) data.address = { ...cur, ...merged };
    }
    if (Object.keys(data).length) {
      await payload.update({
        collection: "users",
        id: doc.id,
        data,
        overrideAccess: true,
      });
    }
  } catch (e) {
    // Non-fatal — the SSO bridge JIT-provisions staff anyway, the (app) layout
    // backstop retries on the next app visit, and `cms:backfill-users` catches
    // up the rest. Log (don't swallow silently) so a systemic mirror failure is
    // diagnosable in the server logs instead of presenting as a silently empty
    // Users page.
    console.warn(
      `[mirror-user] ensureCmsUser failed for ${user.id}`,
      e instanceof Error ? e.message : e,
    );
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
  } catch (e) {
    // Non-fatal — log so a systemic failure is visible in the server logs.
    console.warn(
      `[mirror-user] ensureFreeTag failed for ${userId}`,
      e instanceof Error ? e.message : e,
    );
  }
}
