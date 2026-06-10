import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { z } from "zod/v4";

import { env } from "~/env";
import { getPlan } from "~/lib/payload";
import { getSiteUrl } from "~/lib/site-url";
import { getStripe } from "~/lib/stripe";
import { createClient } from "~/lib/supabase/server";

/**
 * Create a Stripe Checkout session for a Payload plan. Plan-driven: the plan's
 * Stripe price / trial / intro-coupon come from the synced Payload doc, so there
 * are no hardcoded price ids. Works for both signed-in users (upgrade) and
 * anonymous visitors (guest checkout — the webhook provisions the account from
 * the checkout email after payment). The webhook persists customer/subscription.
 */
const bodySchema = z.object({ planId: z.union([z.string(), z.number()]) });

export async function POST(request: Request) {
  if (!env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const plan = await getPlan(parsed.data.planId);
  if (!plan?.stripePriceId) {
    return NextResponse.json(
      { error: "This plan isn't available for purchase yet." },
      { status: 409 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const stripe = getStripe();
  const isSubscription = plan.pricingType === "recurring";

  // Reuse the user's Stripe customer when signed in; guests let Checkout collect
  // the email and we create the account from it in the webhook.
  let customerId: string | undefined;
  if (user) {
    const { data: existing } = await supabase
      .from("customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    customerId = existing?.stripe_customer_id;
    if (!customerId) {
      const byEmail = user.email
        ? await stripe.customers.list({ email: user.email, limit: 1 })
        : null;
      customerId =
        byEmail?.data[0]?.id ??
        (
          await stripe.customers.create({
            email: user.email ?? undefined,
            metadata: { supabase_user_id: user.id },
          })
        ).id;
    }
  }

  // An intro offer is auto-applied via its duration:once coupon. Otherwise allow
  // customers to enter a promotion code (Stripe forbids combining the two).
  const introCoupon = isSubscription ? plan.stripeIntroCouponId : null;
  const metadata: Record<string, string> = {
    plan_id: String(plan.id),
    ...(user ? { supabase_user_id: user.id } : {}),
  };

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: isSubscription ? "subscription" : "payment",
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    metadata,
    success_url: `${getSiteUrl()}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getSiteUrl()}/pricing`,
    ...(customerId ? { customer: customerId } : {}),
    ...(user ? { client_reference_id: user.id } : {}),
    ...(introCoupon
      ? { discounts: [{ coupon: introCoupon }] }
      : { allow_promotion_codes: true }),
  };

  if (isSubscription) {
    params.subscription_data = {
      metadata,
      ...(plan.trialDays ? { trial_period_days: plan.trialDays } : {}),
    };
  } else {
    // One-time (lifetime): ensure a Customer exists so the webhook can link it.
    params.payment_intent_data = { metadata };
    if (!customerId) params.customer_creation = "always";
  }

  const session = await stripe.checkout.sessions.create(params);
  return NextResponse.json({ url: session.url });
}
