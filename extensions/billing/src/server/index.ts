import "server-only";

import type Stripe from "stripe";
import { z } from "zod/v4";

import type { ExtPublicRouteTable, ExtRouteTable } from "@acme/ext-kit/server";

import { getStripe } from "../stripe/client";

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status });

/**
 * The public web origin for Stripe return URLs — same resolution order as the
 * host's lib/site-url.ts (explicit override → Vercel production domain →
 * per-deploy URL → local default), reading core env validated by the host.
 */
function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  const withScheme = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, "");
}

const checkoutSchema = z.object({ planId: z.union([z.string(), z.number()]) });

/**
 * Billing API, served by the host dispatcher at /api/ext/billing/*.
 *
 * `publicRoutes` carries checkout because GUEST checkout is a real flow: an
 * anonymous visitor pays first, then the billing-stripe-webhook edge function
 * matches the checkout email to an account (or creates one + emails an
 * invite). Portal + invoices require a session and live in the authed table.
 */
export const publicRoutes: ExtPublicRouteTable = {
  /** Create a Stripe Checkout session for a Payload plan (plan-driven). */
  "POST /checkout": async (req, ctx) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      return json(503, { error: "Billing not configured" });
    }

    const parsed = checkoutSchema.safeParse(await req.json());
    if (!parsed.success) return json(400, { error: "Invalid plan" });

    const payload = await ctx.getPayload();
    const plan = await payload
      .findByID({
        collection: "ext-billing-plans",
        id: parsed.data.planId,
        depth: 0,
      })
      .catch(() => null);
    if (!plan?.stripePriceId) {
      return json(409, {
        error: "This plan isn't available for purchase yet.",
      });
    }

    const user = ctx.user;
    const stripe = getStripe();
    const isSubscription = plan.pricingType === "recurring";

    // Reuse the user's Stripe customer when signed in; guests let Checkout
    // collect the email and the webhook creates the account from it.
    let customerId: string | undefined;
    if (user) {
      const { data: existing } = await ctx.supabase
        .from("ext_billing_customers")
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

    // An intro offer is auto-applied via its duration:once coupon. Otherwise
    // allow promotion codes (Stripe forbids combining the two).
    const introCoupon = isSubscription ? plan.stripeIntroCouponId : null;
    const metadata: Record<string, string> = {
      plan_id: String(plan.id),
      ...(user ? { supabase_user_id: user.id } : {}),
    };

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: isSubscription ? "subscription" : "payment",
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      metadata,
      success_url: `${siteUrl()}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/pricing`,
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
    return Response.json({ url: session.url });
  },
};

export const routes: ExtRouteTable = {
  /** Open the Stripe customer portal for the signed-in user. */
  "POST /portal": async (_req, ctx) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      return json(503, { error: "Billing not configured" });
    }
    const { data: customer } = await ctx.supabase
      .from("ext_billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    if (!customer?.stripe_customer_id) {
      return json(404, { error: "No billing account" });
    }
    const session = await getStripe().billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: `${siteUrl()}/a`,
    });
    return Response.json({ url: session.url });
  },

  /** The signed-in user's past invoices (trimmed, client-safe shape). */
  "GET /invoices": async (_req, ctx) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      return Response.json({ invoices: [] });
    }
    const { data: customer } = await ctx.supabase
      .from("ext_billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    if (!customer?.stripe_customer_id) {
      return Response.json({ invoices: [] });
    }
    const list = await getStripe().invoices.list({
      customer: customer.stripe_customer_id,
      limit: 24,
    });
    const invoices = list.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      amountPaid: inv.amount_paid,
      currency: inv.currency,
      status: inv.status,
      created: inv.created,
      hostedInvoiceUrl: inv.hosted_invoice_url,
      invoicePdf: inv.invoice_pdf,
    }));
    return Response.json({ invoices });
  },
};
