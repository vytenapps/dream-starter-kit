import "server-only";

import type Stripe from "stripe";
import { z } from "zod/v4";

import type {
  ExtPublicRouteContext,
  ExtPublicRouteTable,
  ExtRouteTable,
} from "@acme/ext-kit/server";

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

const expressIntentSchema = z.object({
  planId: z.union([z.string(), z.number()]),
  // Buyer identity from the wallet sheet / card form — stamped onto the Stripe
  // customer so every future invoice/receipt carries it (not just the first
  // charge, which only the payment method carried).
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
});

const upgradeAnnualSchema = z.object({
  planId: z.union([z.string(), z.number()]),
  // The just-created subscription (embedded flow) — lets the upgrade target it
  // directly, before the webhook has written the customer mapping.
  subscriptionId: z.string().optional(),
});

/**
 * Ensure the Stripe customer carries the buyer's email + name. Sets the name
 * whenever provided, and the email only when the customer doesn't already have
 * one (so a signed-in user's account email is never overwritten by a different
 * wallet email). Best-effort: a failure here must not abort checkout.
 */
async function applyCustomerIdentity(
  stripe: ReturnType<typeof getStripe>,
  customerId: string,
  buyer: { email?: string; name?: string },
): Promise<void> {
  if (!buyer.email && !buyer.name) return;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return;
    const update: Stripe.CustomerUpdateParams = {};
    if (buyer.name && !customer.name) update.name = buyer.name;
    if (buyer.email && !customer.email) update.email = buyer.email;
    if (Object.keys(update).length > 0) {
      await stripe.customers.update(customerId, update);
    }
  } catch (err) {
    console.error("[billing] could not set customer identity:", err);
  }
}

/**
 * Resolve (or create) a Stripe customer for the current request — signed-in
 * users reuse their saved customer; guests get a fresh blank customer the
 * Express Checkout / Payment Element fills in (the webhook matches by email).
 * Shared by /checkout and /express-intent.
 */
async function resolveCustomer(
  ctx: ExtPublicRouteContext,
  stripe: ReturnType<typeof getStripe>,
): Promise<string | undefined> {
  const user = ctx.user;
  if (!user) return undefined;
  const { data: existing } = await ctx.supabase
    .from("ext_billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing?.stripe_customer_id) return existing.stripe_customer_id;
  const byEmail = user.email
    ? await stripe.customers.list({ email: user.email, limit: 1 })
    : null;
  return (
    byEmail?.data[0]?.id ??
    (
      await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      })
    ).id
  );
}

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

  /**
   * Create a payment/setup intent for the EMBEDDED Express Checkout Element
   * (in-modal Apple Pay / Google Pay + card). Returns a `clientSecret` the
   * client mounts via <Elements>. Recurring plans create a subscription
   * (default_incomplete; intro coupon / trial applied) returning its first
   * invoice's PaymentIntent — or a SetupIntent when a trial means no immediate
   * charge; one-time plans return a PaymentIntent.
   *
   * Ties checkout to the session: `ensureAnonSession` runs client-side first, so
   * a logged-out buyer arrives with an anonymous account and the intent stamps
   * `supabase_user_id` in metadata — the webhook then links the subscription to
   * that account (and converts/merges it to permanent once the email is known).
   */
  "POST /express-intent": async (req, ctx) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      return json(503, { error: "Billing not configured" });
    }
    const parsed = expressIntentSchema.safeParse(await req.json());
    if (!parsed.success) return json(400, { error: "Invalid plan" });

    const stripe = getStripe();
    const user = ctx.user;

    try {
      const customerId = await resolveCustomer(ctx, stripe);
      const baseMeta: Record<string, string> = user
        ? { supabase_user_id: user.id }
        : {};

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
      const metadata = { ...baseMeta, plan_id: String(plan.id) };
      const buyer = { email: parsed.data.email, name: parsed.data.name };

      if (plan.pricingType !== "recurring") {
        // Set identity on the customer when one exists; otherwise put the email
        // on the PaymentIntent's receipt so the buyer still gets a receipt.
        if (customerId) await applyCustomerIdentity(stripe, customerId, buyer);
        const pi = await stripe.paymentIntents.create({
          amount: Math.round(plan.unitAmount),
          currency: plan.currency || "usd",
          ...(customerId ? { customer: customerId } : {}),
          ...(buyer.email ? { receipt_email: buyer.email } : {}),
          automatic_payment_methods: { enabled: true },
          metadata,
        });
        return Response.json({
          clientSecret: pi.client_secret,
          mode: "payment",
        });
      }

      // A customer is required to open a subscription.
      const subCustomer =
        customerId ??
        (
          await stripe.customers.create({
            metadata: baseMeta,
            ...(buyer.email ? { email: buyer.email } : {}),
            ...(buyer.name ? { name: buyer.name } : {}),
          })
        ).id;
      // Stamp identity on a reused/existing customer too (fills in blanks).
      await applyCustomerIdentity(stripe, subCustomer, buyer);
      const sub = await stripe.subscriptions.create({
        customer: subCustomer,
        items: [{ price: plan.stripePriceId }],
        metadata,
        ...(plan.trialDays ? { trial_period_days: plan.trialDays } : {}),
        ...(plan.stripeIntroCouponId
          ? { discounts: [{ coupon: plan.stripeIntroCouponId }] }
          : {}),
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        // Stripe API version 2026-05-27.dahlia REMOVED `invoice.payment_intent`.
        // The first invoice's PaymentIntent client secret now lives on
        // `confirmation_secret` (whose `type` is always "payment_intent").
        // Expanding the old field throws and crashed this route with an empty
        // body (client saw "Unexpected end of JSON input").
        expand: ["latest_invoice.confirmation_secret", "pending_setup_intent"],
      });

      const invoice =
        sub.latest_invoice && typeof sub.latest_invoice === "object"
          ? sub.latest_invoice
          : null;
      const paymentSecret = invoice?.confirmation_secret?.client_secret ?? null;
      if (paymentSecret) {
        return Response.json({
          clientSecret: paymentSecret,
          mode: "payment",
          subscriptionId: sub.id,
          customerId: subCustomer,
        });
      }

      // Trial / $0-now subscription: collect a payment method via a SetupIntent.
      const setup =
        sub.pending_setup_intent && typeof sub.pending_setup_intent === "object"
          ? sub.pending_setup_intent
          : null;
      if (setup?.client_secret) {
        return Response.json({
          clientSecret: setup.client_secret,
          mode: "setup",
          subscriptionId: sub.id,
          customerId: subCustomer,
        });
      }
      const si = await stripe.setupIntents.create({
        customer: subCustomer,
        automatic_payment_methods: { enabled: true },
        metadata,
      });
      return Response.json({
        clientSecret: si.client_secret,
        mode: "setup",
        subscriptionId: sub.id,
        customerId: subCustomer,
      });
    } catch (err) {
      // Never crash with an empty body — the client parses JSON and would
      // otherwise surface a cryptic "Unexpected end of JSON input".
      const message =
        err instanceof Error ? err.message : "Could not start checkout.";
      console.error("[billing] express-intent failed:", message);
      return json(502, { error: message });
    }
  },
};

export const routes: ExtRouteTable = {
  /**
   * One-click upgrade-in-place from the active (monthly) subscription to the
   * annual plan, using the payment method already on file. Powers the
   * post-purchase upsell screen. The annual plan's intro coupon discounts the
   * immediate invoice, and `proration_behavior: "none"` keeps the already-paid
   * monthly charge intact so the buyer's first-year spend matches the displayed
   * total. The Stripe webhook mirrors the price change into
   * public.ext_billing_subscriptions, flipping gating to the annual price.
   */
  "POST /upgrade-annual": async (req, ctx) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      return json(503, { error: "Billing not configured" });
    }
    const parsed = upgradeAnnualSchema.safeParse(await req.json());
    if (!parsed.success) return json(400, { error: "Invalid plan" });

    const stripe = getStripe();
    try {
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

      // Resolve the subscription to upgrade. Prefer the id the embedded flow
      // just created (verified to belong to this user) — it works immediately,
      // before the Stripe webhook has written the customer mapping. Fall back to
      // the mapping + active-subscription scan for the hosted/portal path.
      let current: Stripe.Subscription | undefined;
      if (parsed.data.subscriptionId) {
        const sub = await stripe.subscriptions
          .retrieve(parsed.data.subscriptionId)
          .catch(() => null);
        // Ownership check: the subscription must carry this user's id.
        if (sub && sub.metadata.supabase_user_id === ctx.user.id) {
          if (sub.items.data[0]?.price.id === plan.stripePriceId) {
            return json(409, { error: "Already on the annual plan." });
          }
          if (sub.status === "active" || sub.status === "trialing") {
            current = sub;
          }
        }
      }

      if (!current) {
        const { data: customer } = await ctx.supabase
          .from("ext_billing_customers")
          .select("stripe_customer_id")
          .eq("user_id", ctx.user.id)
          .maybeSingle();
        if (!customer?.stripe_customer_id) {
          return json(404, { error: "No billing account" });
        }

        // Find the user's active subscription to upgrade in place. Skip if it's
        // already on the annual price (avoid a redundant charge).
        const subs = await stripe.subscriptions.list({
          customer: customer.stripe_customer_id,
          status: "active",
          limit: 10,
        });
        current = subs.data.find(
          (s) => s.items.data[0]?.price.id !== plan.stripePriceId,
        );
      }
      if (!current) {
        return json(409, { error: "Already on the annual plan." });
      }
      const itemId = current.items.data[0]?.id;
      if (!itemId) {
        return json(409, { error: "No subscription item to upgrade." });
      }

      const metadata = {
        plan_id: String(plan.id),
        supabase_user_id: ctx.user.id,
      };
      await stripe.subscriptions.update(current.id, {
        items: [{ id: itemId, price: plan.stripePriceId }],
        proration_behavior: "none",
        billing_cycle_anchor: "now",
        ...(plan.stripeIntroCouponId
          ? { discounts: [{ coupon: plan.stripeIntroCouponId }] }
          : { discounts: [] }),
        metadata,
      });
      return Response.json({ ok: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not upgrade your plan.";
      console.error("[billing] upgrade-annual failed:", message);
      return json(502, { error: message });
    }
  },

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
