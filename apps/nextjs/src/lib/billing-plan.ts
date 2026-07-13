import "server-only";

import type { PlanLite } from "./paywall-copy";
import { getPayloadClient } from "./cms/payload-client";
import { resolvePremiumPlan } from "./paywall-copy";

/**
 * Resolve the premium plan server-side (Payload Local API) so a gated content
 * page can SSR-seed the paywall with pricing — the modal then opens instantly,
 * no client fetch. Mirrors the client fallback in PaywallProvider
 * (resolvePremiumPlan over active plans). Returns null when billing isn't set up
 * yet so the gate degrades gracefully.
 */
export async function getPremiumPlan(): Promise<PlanLite | null> {
  try {
    const payload = await getPayloadClient();
    const { docs } = await payload.find({
      collection: "ext-billing-plans",
      where: { active: { equals: true } },
      sort: "displayOrder",
      limit: 50,
      depth: 0,
    });
    return resolvePremiumPlan(docs as unknown as PlanLite[]);
  } catch {
    return null;
  }
}
