"use client";

import { useQuery } from "@tanstack/react-query";

import type { ExtBillingPlan as Plan } from "@acme/cms";

// `process.env.*_PUBLIC_*` is inlined by each platform's bundler (Metro / Next).
declare const process: { env: Record<string, string | undefined> };

const CMS_BASE =
  process.env.EXPO_PUBLIC_CMS_URL ?? process.env.NEXT_PUBLIC_CMS_URL ?? "";

/**
 * Active plans from the CMS REST API (public read) — the native pricing
 * screen's data source. Stripe is web-only (golden rule #4): mobile DISPLAYS
 * plans and links out to the web pricing page to subscribe.
 */
export const usePlans = () =>
  useQuery({
    queryKey: ["cms", "ext-billing-plans"],
    queryFn: async (): Promise<Plan[]> => {
      const res = await fetch(
        `${CMS_BASE}/cms-api/ext-billing-plans?where[active][equals]=true&sort=displayOrder&limit=50`,
      );
      if (!res.ok) throw new Error(`CMS request failed (${res.status})`);
      const data = (await res.json()) as { docs: Plan[] };
      return data.docs;
    },
  });
