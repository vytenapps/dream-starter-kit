import type { CollectionAfterChangeHook } from "payload";

import type { Coupon } from "@acme/cms";

import { env } from "~/env";
import { getStripe } from "~/lib/stripe";
import { syncCouponToStripe } from "~/lib/stripe/sync";

/** Stripe product ids of the plans a coupon is restricted to (empty = all). */
function resolveProductIds(appliesTo: Coupon["appliesTo"]): string[] {
  if (!Array.isArray(appliesTo)) return [];
  return appliesTo
    .map((p) => (typeof p === "object" ? (p.stripeProductId ?? null) : null))
    .filter((id): id is string => Boolean(id));
}

/**
 * Automatic Stripe sync for coupons — Stripe coupons are immutable for
 * amount/duration, so the sync recreates + archives on change and mints a
 * fresh promotion code when needed (lib/stripe/sync.ts). Same skip/error
 * semantics as the plans hook.
 */
export const syncCouponAfterChange: CollectionAfterChangeHook<Coupon> = async ({
  context,
  doc,
  req,
}) => {
  if (context.skipStripeSync || doc.skipSync || !env.STRIPE_SECRET_KEY) {
    return doc;
  }

  try {
    // Re-read with depth 1 so appliesTo plans carry their stripeProductId.
    const populated = await req.payload.findByID({
      collection: "coupons",
      id: doc.id,
      depth: 1,
      overrideAccess: true,
      req,
    });
    const res = await syncCouponToStripe(getStripe(), {
      id: doc.id,
      name: doc.name,
      discountType: doc.discountType,
      value: doc.value,
      currency: doc.currency,
      duration: doc.duration,
      durationCount: doc.durationCount,
      durationUnit: doc.durationUnit,
      maxRedemptions: doc.maxRedemptions,
      redeemBy: doc.redeemBy,
      code: doc.code,
      appliesToProductIds: resolveProductIds(populated.appliesTo),
      stripeCouponId: doc.stripeCouponId,
      stripePromotionCodeId: doc.stripePromotionCodeId,
    });
    return await req.payload.update({
      collection: "coupons",
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
    req.payload.logger.error(
      { err },
      `coupons: Stripe sync failed (${doc.id})`,
    );
    return await req.payload
      .update({
        collection: "coupons",
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
