import "server-only";

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
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
      .from("ext_billing_subscriptions")
      .select("id")
      .in("status", ACTIVE_STATUSES)
      .limit(1);
    return Boolean(data && data.length > 0);
  } catch {
    return false;
  }
}
