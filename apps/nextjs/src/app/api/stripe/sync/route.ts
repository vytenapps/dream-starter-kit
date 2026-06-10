import { headers } from "next/headers";
import { NextResponse } from "next/server";
import config from "@payload-config";
import { getPayload } from "payload";
import { z } from "zod/v4";

import type { Coupon } from "@acme/cms";

import { env } from "~/env";
import { getStripe } from "~/lib/stripe";
import { syncCouponToStripe, syncPlanToStripe } from "~/lib/stripe/sync";

/**
 * Push a Payload plan/coupon (or all of them) into Stripe. Triggered by the
 * "Sync to Stripe" button in the admin; authed via the Payload admin session
 * (same as /api/cms/seed). Writes the resulting Stripe ids + sync status back
 * onto the doc. See lib/stripe/sync.ts for the immutable-resource logic.
 */
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  collection: z.enum(["plans", "coupons"]),
  id: z.union([z.string(), z.number()]).optional(),
  all: z.boolean().optional(),
});

/** Stripe product ids of the related (depth-1) plans a coupon is restricted to. */
function resolveProductIds(appliesTo: Coupon["appliesTo"]): string[] {
  if (!Array.isArray(appliesTo)) return [];
  return appliesTo
    .map((p) => (typeof p === "object" ? (p.stripeProductId ?? null) : null))
    .filter((id): id is string => Boolean(id));
}

export async function POST(request: Request) {
  if (!env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe is not configured (STRIPE_SECRET_KEY is missing)." },
      { status: 503 },
    );
  }

  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await headers() });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success || (!parsed.data.id && !parsed.data.all)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { collection, id } = parsed.data;
  const stripe = getStripe();

  // Collect the doc ids to sync (one, or every doc in the collection).
  const ids: (string | number)[] = id
    ? [id]
    : (await payload.find({ collection, limit: 1000, depth: 0 })).docs.map(
        (d) => d.id,
      );

  const results: { id: string | number; ok: boolean; error?: string }[] = [];
  for (const docId of ids) {
    try {
      if (collection === "plans") {
        const plan = await payload.findByID({
          collection: "plans",
          id: docId,
          depth: 0,
        });
        const res = await syncPlanToStripe(stripe, {
          id: plan.id,
          name: plan.name,
          description: plan.description,
          pricingType: plan.pricingType,
          interval: plan.interval,
          unitAmount: plan.unitAmount,
          currency: plan.currency,
          active: plan.active ?? true,
          introOffer: plan.introOffer,
          stripeProductId: plan.stripeProductId,
          stripePriceId: plan.stripePriceId,
          stripeIntroCouponId: plan.stripeIntroCouponId,
        });
        await payload.update({
          collection: "plans",
          id: docId,
          data: {
            ...res,
            syncStatus: "synced",
            syncError: null,
            lastSyncedAt: new Date().toISOString(),
          },
          overrideAccess: true,
        });
      } else {
        const coupon = await payload.findByID({
          collection: "coupons",
          id: docId,
          depth: 1,
        });
        const res = await syncCouponToStripe(stripe, {
          id: coupon.id,
          name: coupon.name,
          discountType: coupon.discountType,
          value: coupon.value,
          currency: coupon.currency,
          duration: coupon.duration,
          durationCount: coupon.durationCount,
          durationUnit: coupon.durationUnit,
          maxRedemptions: coupon.maxRedemptions,
          redeemBy: coupon.redeemBy,
          code: coupon.code,
          appliesToProductIds: resolveProductIds(coupon.appliesTo),
          stripeCouponId: coupon.stripeCouponId,
          stripePromotionCodeId: coupon.stripePromotionCodeId,
        });
        await payload.update({
          collection: "coupons",
          id: docId,
          data: {
            ...res,
            syncStatus: "synced",
            syncError: null,
            lastSyncedAt: new Date().toISOString(),
          },
          overrideAccess: true,
        });
      }
      results.push({ id: docId, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      await payload
        .update({
          collection,
          id: docId,
          data: { syncStatus: "error", syncError: message },
          overrideAccess: true,
        })
        .catch(() => undefined);
      results.push({ id: docId, ok: false, error: message });
    }
  }

  const failed = results.filter((r) => !r.ok);
  return NextResponse.json(
    { results, synced: results.length - failed.length, failed: failed.length },
    { status: failed.length && !id ? 207 : failed.length ? 502 : 200 },
  );
}
