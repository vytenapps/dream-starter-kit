import "server-only";

import { cache } from "react";

import { createClient } from "~/lib/supabase/server";

const ACTIVE_STATUSES = ["active", "trialing"];

/**
 * Server-side mirror of `usePremium`: whether the current viewer (resolved from
 * their Supabase session cookie) holds an active/trialing subscription —
 * read-own via RLS on `ext_billing_subscriptions`.
 *
 * Used to gate premium content in RSC *before* it reaches the client, so locked
 * content is never shipped to non-entitled viewers (the client paywall is
 * visual-only and otherwise leaks). Fails **closed** (returns false) on any
 * error — better to over-gate than to leak.
 */
export async function isViewerPremium(): Promise<boolean> {
  return (await getViewerEntitlement()).isPremium;
}

/**
 * The viewer's content entitlement, resolved from their Supabase session — pass
 * straight into a Payload Local-API read as `context` so `premiumFieldAccess`
 * (payload/access) gates `members`/`premium` fields. `isLoggedIn` excludes
 * anonymous Supabase users (they aren't "members"). Fails closed.
 */
export const getViewerEntitlement = cache(
  async function getViewerEntitlement(): Promise<{
    isPremium: boolean;
    isLoggedIn: boolean;
    /** The viewer's email (for owner-scoped reads, e.g. a claimed idea). */
    email: string | null;
  }> {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || user.is_anonymous)
        return { isPremium: false, isLoggedIn: false, email: null };
      const { data } = await supabase
        .from("ext_billing_subscriptions")
        .select("id")
        .in("status", ACTIVE_STATUSES)
        .limit(1);
      return {
        isPremium: Boolean(data && data.length > 0),
        isLoggedIn: true,
        email: user.email ?? null,
      };
    } catch {
      return { isPremium: false, isLoggedIn: false, email: null };
    }
  },
);
