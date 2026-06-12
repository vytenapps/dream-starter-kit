import type { CollectionAfterChangeHook } from "payload";

import type { ExtBillingPlan as Plan } from "@acme/cms";

import { getStripe } from "../../stripe/client";
import { syncPlanToStripe } from "../../stripe/sync";

/**
 * Automatic Stripe sync: saving a plan creates/updates the Stripe product and
 * (because Stripe prices are immutable) creates a new price + archives the old
 * one when the amount/interval changes — see lib/stripe/sync.ts. Replaces the
 * old manual "Sync to Stripe" button.
 *
 * Skipped when: Stripe isn't configured, the doc opts out (`skipSync`), or the
 * write came from this hook itself / the seed (`context.skipStripeSync`).
 * A failure is recorded on `syncStatus`/`syncError` instead of failing the save.
 */
export const syncPlanAfterChange: CollectionAfterChangeHook<Plan> = async ({
  context,
  doc,
  req,
}) => {
  if (
    context.skipStripeSync ||
    doc.skipSync ||
    !process.env.STRIPE_SECRET_KEY
  ) {
    return doc;
  }

  try {
    const res = await syncPlanToStripe(getStripe(), {
      id: doc.id,
      name: doc.name,
      description: doc.description,
      pricingType: doc.pricingType,
      interval: doc.interval,
      unitAmount: doc.unitAmount,
      currency: doc.currency,
      active: doc.active ?? true,
      introOffer: doc.introOffer,
      stripeProductId: doc.stripeProductId,
      stripePriceId: doc.stripePriceId,
      stripeIntroCouponId: doc.stripeIntroCouponId,
    });
    return await req.payload.update({
      collection: "ext-billing-plans",
      id: doc.id,
      data: {
        ...res,
        syncStatus: "synced",
        syncError: null,
        lastSyncedAt: new Date().toISOString(),
      },
      depth: 0,
      overrideAccess: true,
      context: { skipStripeSync: true },
      req,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe sync failed";
    req.payload.logger.error({ err }, `plans: Stripe sync failed (${doc.id})`);
    return await req.payload
      .update({
        collection: "ext-billing-plans",
        id: doc.id,
        data: { syncStatus: "error", syncError: message },
        depth: 0,
        overrideAccess: true,
        context: { skipStripeSync: true },
        req,
      })
      .catch(() => doc);
  }
};
