"use client";

import { useQuery } from "@tanstack/react-query";

import { useSession, useSupabase } from "@acme/api";

const ACTIVE_STATUSES = ["active", "trialing"];

/**
 * Premium gating — reads the user's subscription (RLS: read-own) and returns
 * whether they have an active/trialing plan. Identical on web + native; the
 * Stripe webhook is the only writer of the subscriptions table.
 */
export function usePremium() {
  const supabase = useSupabase();
  const { user } = useSession();

  const query = useQuery({
    queryKey: ["subscription", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
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
    subscription: query.data ?? null,
    isLoading: query.isLoading,
  };
}
