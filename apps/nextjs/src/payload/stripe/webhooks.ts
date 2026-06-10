import type { StripeWebhookHandler } from "@payloadcms/plugin-stripe/types";
import type Stripe from "stripe";

import type { Subscription, User } from "@acme/cms";

import { createAdminClient } from "~/lib/supabase/admin";

/**
 * Stripe → CMS `subscriptions` mirror, registered with
 * @payloadcms/plugin-stripe for the customer.subscription.* events
 * (POST /cms-api/stripe/webhooks — its own signing secret,
 * STRIPE_WEBHOOKS_ENDPOINT_SECRET, distinct from the Supabase edge
 * function's endpoint which keeps writing public.* for RLS clients).
 *
 * Upserts are keyed by the Stripe subscription id, so out-of-order /
 * duplicate deliveries settle on the latest state. The user is resolved
 * customer id → public.customers (service-role read; allowed server-side per
 * golden rule #2) → cms users by supabaseUserId, with a customer-email
 * fallback for guest checkouts mirrored before the account existed.
 */

const toIso = (seconds: number | null | undefined): string | null =>
  seconds == null ? null : new Date(seconds * 1000).toISOString();

const mapStatus = (
  s: Stripe.Subscription.Status,
  deleted: boolean,
): Subscription["status"] => {
  if (deleted) return "churned";
  switch (s) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "canceled":
      return "canceled";
    case "paused":
      return "paused";
    // past_due / unpaid / incomplete / incomplete_expired — payment trouble.
    default:
      return "past_due";
  }
};

export const syncSubscriptionFromStripe: StripeWebhookHandler<
  | Stripe.CustomerSubscriptionCreatedEvent
  | Stripe.CustomerSubscriptionUpdatedEvent
  | Stripe.CustomerSubscriptionDeletedEvent
> = async ({ event, payload, stripe }) => {
  const sub = event.data.object;
  const deleted = event.type === "customer.subscription.deleted";
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // Resolve the member: Stripe customer → public.customers → cms users.
  let user: Pick<User, "id"> | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("customers")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (data?.user_id) {
      const { docs } = await payload.find({
        collection: "users",
        where: { supabaseUserId: { equals: data.user_id } },
        limit: 1,
        depth: 0,
        trash: true,
        overrideAccess: true,
      });
      user = docs[0] ?? null;
    }
  } catch (err) {
    payload.logger.warn({ err }, "stripe-webhook: customers lookup failed");
  }
  if (!user) {
    // Fallback: match by the Stripe customer's email.
    try {
      const customer = await stripe.customers.retrieve(customerId);
      const email = !customer.deleted ? customer.email : null;
      if (email) {
        const { docs } = await payload.find({
          collection: "users",
          where: { email: { equals: email } },
          limit: 1,
          depth: 0,
          trash: true,
          overrideAccess: true,
        });
        user = docs[0] ?? null;
      }
    } catch (err) {
      payload.logger.warn({ err }, "stripe-webhook: customer email fallback failed");
    }
  }

  // Resolve the plan by the price the subscription is on.
  const item = sub.items.data[0];
  const priceId = item?.price.id;
  let planId: Subscription["plan"] = null;
  if (priceId) {
    const { docs } = await payload.find({
      collection: "plans",
      where: { stripePriceId: { equals: priceId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    planId = docs[0]?.id ?? null;
  }

  const data = {
    user: user?.id ?? null,
    plan: planId,
    status: mapStatus(sub.status, deleted),
    startedAt: toIso(sub.start_date),
    trialEndsAt: toIso(sub.trial_end),
    // stripe v22 (API 2025+): the billing period lives on the item.
    currentPeriodStart: toIso(item?.current_period_start),
    currentPeriodEnd: toIso(item?.current_period_end),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    canceledAt: toIso(sub.canceled_at),
    stripeSubscriptionID: sub.id,
    stripeCustomerID: customerId,
  };

  const existing = await payload.find({
    collection: "subscriptions",
    where: { stripeSubscriptionID: { equals: sub.id } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  if (existing.docs[0]) {
    await payload.update({
      collection: "subscriptions",
      id: existing.docs[0].id,
      data,
      depth: 0,
      overrideAccess: true,
    });
  } else {
    await payload.create({
      collection: "subscriptions",
      data,
      depth: 0,
      overrideAccess: true,
    });
  }
};
