import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@acme/api/types";

type Admin = SupabaseClient<Database>;

/** Find an auth user id by email (paged scan — fine at starter-kit scale). */
export async function findUserIdByEmail(
  admin: Admin,
  email: string,
): Promise<string | null> {
  const target = email.toLowerCase();
  const perPage = 200;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < perPage) return null;
  }
}

/**
 * Merge an anonymous user's data into an existing permanent account, then delete
 * the anonymous user. Used when a checkout/conversion email already belongs to an
 * account (the anon user can't take that email). Reassigns the rows that matter —
 * billing first (subscriptions + customer mapping cascade-delete with the anon
 * user, so they MUST move before deletion), then favorites/reminders.
 *
 * Stripe has no "merge customers" API: if the existing user already has a
 * customer mapping we keep theirs and drop the anon's (logged) — the subscription
 * row is still repointed so premium gating is correct. Service-role only.
 */
export async function mergeAnonUser(
  admin: Admin,
  anonId: string,
  realId: string,
): Promise<void> {
  // Subscriptions: PK is the Stripe id, so repointing user_id never collides.
  await admin
    .from("ext_billing_subscriptions")
    .update({ user_id: realId })
    .eq("user_id", anonId);

  // Customer mapping (user_id is UNIQUE): move it unless the target already has
  // one, in which case drop the anon's (it would cascade-delete anyway).
  const { data: realCustomer } = await admin
    .from("ext_billing_customers")
    .select("user_id")
    .eq("user_id", realId)
    .maybeSingle();
  if (realCustomer) {
    console.warn(
      `[merge-anon] ${realId} already has a Stripe customer; dropping anon ${anonId}'s mapping (manual review may be needed).`,
    );
    await admin.from("ext_billing_customers").delete().eq("user_id", anonId);
  } else {
    await admin
      .from("ext_billing_customers")
      .update({ user_id: realId })
      .eq("user_id", anonId);
  }

  // Favorites: copy across (ignore items the target already saved); the anon's
  // rows cascade-delete with the user below.
  const { data: favs } = await admin
    .from("content_favorites")
    .select("collection, item_id")
    .eq("user_id", anonId);
  if (favs?.length) {
    await admin.from("content_favorites").upsert(
      favs.map((f) => ({ ...f, user_id: realId })),
      { onConflict: "user_id,collection,item_id", ignoreDuplicates: true },
    );
  }

  // Best-effort for the rest (none are premium-critical).
  await admin
    .from("ext_reminders")
    .update({ user_id: realId })
    .eq("user_id", anonId)
    .then(undefined, () => undefined);

  // Finally remove the anonymous user (cascades any leftover owned rows).
  await admin.auth.admin.deleteUser(anonId);
}

/**
 * Safety net for the "paid anonymous user never confirmed, then signed up fresh"
 * case: find any leftover anonymous users carrying this email (as their primary
 * OR pending `new_email`, set during the conversion attempt) and merge their
 * billing/favorites into the now-permanent account. Called from /welcome after
 * sign-in/sign-up. Best-effort; the caller guards so the listUsers scan only runs
 * for accounts that haven't transacted yet.
 */
export async function reconcileAnonByEmail(
  admin: Admin,
  realId: string,
  email: string,
): Promise<void> {
  const target = email.toLowerCase();
  const perPage = 200;
  const orphans: string[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    for (const u of data.users) {
      if (u.id === realId || !u.is_anonymous) continue;
      const pending = (u as { new_email?: string | null }).new_email ?? null;
      if (
        u.email?.toLowerCase() === target ||
        pending?.toLowerCase() === target
      ) {
        orphans.push(u.id);
      }
    }
    if (data.users.length < perPage) break;
  }
  for (const anonId of orphans) {
    await mergeAnonUser(admin, anonId, realId);
  }
}
