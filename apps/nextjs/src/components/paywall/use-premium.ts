"use client";

import { useQuery } from "@tanstack/react-query";

import { useSession, useSupabase } from "@acme/api";

const ACTIVE_STATUSES = ["active", "trialing"];

/**
 * Premium gating for content. Reads the user's billing subscription
 * (RLS: read-own) — the same source the billing extension's `usePremium`
 * service uses — without importing `@acme/ext-billing` from host code (the
 * CLAUDE.md extension-boundary rule). The Stripe webhook is the only writer of
 * the subscriptions table. Anonymous visitors are never premium (the gate shows
 * the paywall; checkout supports guest/anon purchase + post-pay account
 * conversion).
 */
export function usePremium() {
  const supabase = useSupabase();
  const { user } = useSession();

  const query = useQuery({
    queryKey: ["subscription", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ext_billing_subscriptions")
        .select("status, price_id, current_period_end")
        .in("status", ACTIVE_STATUSES)
        .order("current_period_end", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return {
    isPremium: !!query.data,
    isLoading: !!user && query.isLoading,
    userEmail: user?.email ?? null,
  };
}
