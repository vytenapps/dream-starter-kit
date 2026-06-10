import "server-only";

import type Stripe from "stripe";

/**
 * Push Payload-authored plans and coupons into Stripe (the manual "Sync to
 * Stripe" action). Stripe prices and coupons are **immutable** for their core
 * fields — you cannot change a price's amount or a coupon's discount/duration.
 * So when those change we CREATE a new resource and ARCHIVE the old one, keeping
 * the Payload doc pointed at the current Stripe id. Name/description/metadata are
 * updated in place.
 *
 * The Stripe webhook (supabase/functions/stripe-webhook) mirrors the resulting
 * products/prices back into the RLS-governed public.* tables, so this is the
 * write side of a one-way Payload → Stripe → DB pipeline. Every Stripe object
 * carries `metadata.payloadId` so we can re-link if a stored id is ever lost.
 *
 * The functions take an injected `Stripe` client and plain input shapes (mapped
 * from the Payload docs by the caller) so the immutable-resource logic stays
 * unit-testable without Payload's generated types or a live Stripe key.
 */

export interface PlanSyncInput {
  id: string | number;
  name: string;
  description?: string | null;
  pricingType: "recurring" | "one_time";
  interval?: "month" | "year" | null;
  /** Amount in the smallest currency unit (cents). */
  unitAmount: number;
  currency: string;
  active: boolean;
  introOffer?: { enabled?: boolean | null; introAmount?: number | null } | null;
  stripeProductId?: string | null;
  stripePriceId?: string | null;
  stripeIntroCouponId?: string | null;
}

export interface PlanSyncResult {
  stripeProductId: string;
  stripePriceId: string;
  stripeIntroCouponId: string | null;
}

export interface CouponSyncInput {
  id: string | number;
  name: string;
  discountType: "percent_off" | "amount_off";
  value: number;
  currency?: string | null;
  duration: "once" | "repeating" | "forever";
  durationCount?: number | null;
  durationUnit?: "month" | "year" | null;
  maxRedemptions?: number | null;
  /** ISO date string; becomes Stripe `redeem_by` (seconds). */
  redeemBy?: string | null;
  /** Optional customer-facing promotion code (e.g. LAUNCH20). */
  code?: string | null;
  /** Resolved Stripe product ids this coupon is restricted to (empty = all). */
  appliesToProductIds?: string[];
  stripeCouponId?: string | null;
  stripePromotionCodeId?: string | null;
}

export interface CouponSyncResult {
  stripeCouponId: string;
  stripePromotionCodeId: string | null;
}

// --- Pure helpers (exported for unit tests) -------------------------------

/**
 * Convert a repeating coupon's duration (N months or N years) into Stripe's
 * months-only `duration_in_months`. e.g. 6 months → 6; 2 years → 24.
 */
export function durationInMonths(input: CouponSyncInput): number | undefined {
  if (input.duration !== "repeating") return undefined;
  const count = Math.max(1, Math.floor(input.durationCount ?? 1));
  return input.durationUnit === "year" ? count * 12 : count;
}

/** ISO date → unix seconds (Stripe uses second-precision timestamps). */
export function toUnixSeconds(iso?: string | null): number | undefined {
  if (!iso) return undefined;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
}

/**
 * Whether the live Stripe price diverges from the desired plan pricing and must
 * be re-created (prices are immutable). Compares amount, currency, and the
 * recurring interval / one-time-ness.
 */
export function priceNeedsRecreate(
  live: Pick<Stripe.Price, "unit_amount" | "currency" | "recurring" | "active">,
  plan: PlanSyncInput,
): boolean {
  if (!live.active) return true;
  if (live.unit_amount !== plan.unitAmount) return true;
  if (live.currency !== plan.currency.toLowerCase()) return true;
  const wantRecurring = plan.pricingType === "recurring";
  const liveRecurring = Boolean(live.recurring);
  if (wantRecurring !== liveRecurring) return true;
  if (wantRecurring && live.recurring?.interval !== (plan.interval ?? "month"))
    return true;
  return false;
}

/** The amount_off (cents) for a plan's intro offer, or null when not applicable. */
export function introAmountOff(plan: PlanSyncInput): number | null {
  if (plan.pricingType !== "recurring") return null;
  if (!plan.introOffer?.enabled) return null;
  const intro = plan.introOffer.introAmount;
  if (intro == null) return null;
  const off = plan.unitAmount - intro;
  return off > 0 ? off : null;
}

// --- Plan sync ------------------------------------------------------------

export async function syncPlanToStripe(
  stripe: Stripe,
  plan: PlanSyncInput,
): Promise<PlanSyncResult> {
  const metadata = { payloadId: String(plan.id), payloadCollection: "plans" };

  // 1. Product — created if missing, otherwise updated in place.
  let productId = plan.stripeProductId ?? "";
  const productData: Stripe.ProductUpdateParams = {
    name: plan.name,
    description: plan.description?.trim() ? plan.description : undefined,
    active: plan.active,
    metadata,
  };
  if (productId) {
    await stripe.products.update(productId, productData);
  } else {
    const product = await stripe.products.create({
      ...(productData as Stripe.ProductCreateParams),
      name: plan.name,
    });
    productId = product.id;
  }

  // 2. Price — immutable, so create a new one + archive the old when it diverges.
  let priceId = plan.stripePriceId ?? "";
  let recreate = !priceId;
  if (priceId) {
    try {
      const live = await stripe.prices.retrieve(priceId);
      recreate = priceNeedsRecreate(live, plan);
    } catch {
      recreate = true; // stored id no longer resolves
    }
  }
  if (recreate) {
    const newPrice = await stripe.prices.create({
      product: productId,
      currency: plan.currency.toLowerCase(),
      unit_amount: plan.unitAmount,
      recurring:
        plan.pricingType === "recurring"
          ? { interval: plan.interval ?? "month" }
          : undefined,
      metadata,
    });
    await stripe.products.update(productId, { default_price: newPrice.id });
    if (priceId) {
      await stripe.prices.update(priceId, { active: false }).catch(() => {
        // Old price may already be archived/missing — ignore.
      });
    }
    priceId = newPrice.id;
  }

  // 3. Intro offer — a duration:once coupon applied at checkout.
  let introCouponId = plan.stripeIntroCouponId ?? null;
  const amountOff = introAmountOff(plan);
  if (amountOff != null) {
    const desired = {
      amount_off: amountOff,
      currency: plan.currency.toLowerCase(),
      duration: "once" as const,
      name: `${plan.name} — intro offer`,
      metadata,
    };
    let reuse = false;
    if (introCouponId) {
      try {
        const live = await stripe.coupons.retrieve(introCouponId);
        reuse =
          live.valid &&
          live.amount_off === amountOff &&
          live.currency === desired.currency &&
          live.duration === "once";
        if (reuse) await stripe.coupons.update(introCouponId, { name: desired.name });
      } catch {
        reuse = false;
      }
    }
    if (!reuse) {
      const coupon = await stripe.coupons.create(desired);
      introCouponId = coupon.id;
    }
  } else if (introCouponId) {
    // Intro offer turned off — drop the coupon (existing subs are unaffected).
    await stripe.coupons.del(introCouponId).catch(() => undefined);
    introCouponId = null;
  }

  return { stripeProductId: productId, stripePriceId: priceId, stripeIntroCouponId: introCouponId };
}

// --- Coupon sync ----------------------------------------------------------

export async function syncCouponToStripe(
  stripe: Stripe,
  coupon: CouponSyncInput,
): Promise<CouponSyncResult> {
  const metadata = { payloadId: String(coupon.id), payloadCollection: "coupons" };
  const months = durationInMonths(coupon);
  const productIds = coupon.appliesToProductIds ?? [];
  const redeemBy = toUnixSeconds(coupon.redeemBy);

  const desired: Stripe.CouponCreateParams = {
    name: coupon.name,
    duration: coupon.duration,
    ...(coupon.duration === "repeating" ? { duration_in_months: months } : {}),
    ...(coupon.discountType === "percent_off"
      ? { percent_off: coupon.value }
      : { amount_off: coupon.value, currency: (coupon.currency ?? "usd").toLowerCase() }),
    ...(coupon.maxRedemptions ? { max_redemptions: coupon.maxRedemptions } : {}),
    ...(redeemBy ? { redeem_by: redeemBy } : {}),
    ...(productIds.length ? { applies_to: { products: productIds } } : {}),
    metadata,
  };

  // Coupons are immutable for discount/duration → recreate when those change.
  let couponId = coupon.stripeCouponId ?? "";
  let reuse = false;
  if (couponId) {
    try {
      const live = await stripe.coupons.retrieve(couponId);
      reuse =
        live.valid &&
        live.duration === coupon.duration &&
        (live.duration !== "repeating" || live.duration_in_months === months) &&
        (coupon.discountType === "percent_off"
          ? live.percent_off === coupon.value
          : live.amount_off === coupon.value &&
            live.currency === (coupon.currency ?? "usd").toLowerCase());
      if (reuse) await stripe.coupons.update(couponId, { name: coupon.name, metadata });
    } catch {
      reuse = false;
    }
  }
  if (!reuse) {
    if (couponId) await stripe.coupons.del(couponId).catch(() => undefined);
    const created = await stripe.coupons.create(desired);
    couponId = created.id;
  }

  // Promotion code — created once per coupon. Stripe forbids changing a code's
  // coupon, so a recreated coupon gets a fresh promotion code.
  let promoId = coupon.stripePromotionCodeId ?? null;
  if (coupon.code?.trim()) {
    const needNew = !promoId || !reuse;
    if (needNew) {
      const promo = await stripe.promotionCodes.create({
        promotion: { type: "coupon", coupon: couponId },
        code: coupon.code.trim(),
        ...(coupon.maxRedemptions ? { max_redemptions: coupon.maxRedemptions } : {}),
        ...(redeemBy ? { expires_at: redeemBy } : {}),
        metadata,
      });
      promoId = promo.id;
    }
  }

  return { stripeCouponId: couponId, stripePromotionCodeId: promoId };
}
