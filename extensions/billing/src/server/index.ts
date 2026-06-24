import "server-only";

import type Stripe from "stripe";
import { z } from "zod/v4";

import type {
  ExtPublicRouteContext,
  ExtPublicRouteTable,
  ExtRouteTable,
} from "@acme/ext-kit/server";

import { getStripe } from "../stripe/client";
import { createAdminClient } from "./admin-client";

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
  // Guest (no session) path: the wallet email, verified against the
  // subscription's Stripe customer before upgrading the just-bought sub.
  email: z.string().email().optional(),
});

const guestAccountSchema = z.object({
  email: z.string().email(),
  // Buyer identity from the wallet sheet — stored on the new account.
  name: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  // Wallet billing address (Stripe shape: line1/line2/city/state/postal_code/
  // country). Carried into user_metadata so the cms.users mirror can populate
  // its billing address (incl. zip) — profiles has no column for it.
  address: z.record(z.string(), z.unknown()).nullish(),
  // The just-completed embedded purchase — at least one is required, both to
  // prove this is a real checkout and to find the Stripe customer to link.
  subscriptionId: z.string().optional(),
  customerId: z.string().optional(),
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

/** Find an auth user id by email (paged scan — fine at starter-kit scale). */
async function findUserIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<string | null> {
  const target = email.toLowerCase();
  const perPage = 200;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < perPage) return null;
  }
}

/** Stripe sends Unix seconds; the DB wants ISO timestamps (or null). */
function isoOrNull(seconds: number | null | undefined): string | null {
  return typeof seconds === "number"
    ? new Date(seconds * 1000).toISOString()
    : null;
}

/**
 * Map a Stripe subscription to the public.ext_billing_subscriptions row — the
 * same shape the webhook's mapSubscription produces, inlined here so this route
 * stays independent of the (Deno) edge-function module. Recent Stripe API
 * versions moved current_period_end onto the subscription item; read it there
 * first, falling back to the subscription-level field.
 */
function subscriptionRow(sub: Stripe.Subscription, userId: string) {
  const item = sub.items.data[0];
  const itemEnd = (
    item as unknown as { current_period_end?: number } | undefined
  )?.current_period_end;
  const subEnd = (sub as unknown as { current_period_end?: number })
    .current_period_end;
  return {
    id: sub.id,
    user_id: userId,
    price_id: item?.price.id ?? null,
    status: sub.status,
    quantity: item?.quantity ?? null,
    cancel_at_period_end: sub.cancel_at_period_end,
    current_period_end: isoOrNull(itemEnd) ?? isoOrNull(subEnd),
  };
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

  /**
   * Guest checkout, EMBEDDED-wallet path: a logged-out buyer just paid via the
   * in-modal Express Checkout (Apple/Google Pay) WITHOUT an anonymous session
   * (e.g. anon sign-in / Turnstile unavailable, so `ensureAnonSession` no-op'd).
   * The modal calls this at "Continue"/"Maybe later" to GUARANTEE the account +
   * invite email synchronously, instead of only showing "check your email" and
   * banking on Stripe webhook timing/config. It:
   *
   *  - find-or-invites the Supabase account by the checkout email (a brand-new
   *    account gets the set-password invite to /accept-invite),
   *  - stamps supabase_user_id onto the Stripe customer + subscription (so the
   *    webhook and the portal/upgrade routes resolve the user later), and
   *  - links ext_billing_customers + mirrors the subscription row so premium
   *    unlocks immediately for RLS clients.
   *
   * Abuse-safe: a real subscription/customer id is required and its Stripe
   * customer email must match `email`, so this public route can't be used to
   * spam invites or probe which emails have accounts. Idempotent with the
   * webhook (still the backstop): an existing email links with no second email.
   */
  "POST /guest-account": async (req, ctx) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      return json(503, { error: "Billing not configured" });
    }
    const parsed = guestAccountSchema.safeParse(await req.json());
    if (!parsed.success) return json(400, { error: "Invalid request" });
    const { email, name, phone, address, subscriptionId, customerId } =
      parsed.data;
    if (!subscriptionId && !customerId) {
      return json(400, { error: "Missing purchase reference" });
    }
    // Billing zip from the wallet address — profiles has no column for it, so it
    // rides user_metadata into the cms.users mirror (which has an address group).
    const postalCode =
      address && typeof address.postal_code === "string"
        ? address.postal_code
        : undefined;

    // A signed-in, non-anonymous caller already has an account — nothing to do.
    if (ctx.user && !ctx.user.is_anonymous) {
      return Response.json({ ok: true, existing: true });
    }

    const stripe = getStripe();
    try {
      // Resolve + verify the purchase: the Stripe customer's email (stamped by
      // express-intent from the wallet sheet) must match the requested email.
      let sub: Stripe.Subscription | null = null;
      let resolvedCustomerId = customerId ?? null;
      if (subscriptionId) {
        sub = await stripe.subscriptions
          .retrieve(subscriptionId)
          .catch(() => null);
        if (sub) {
          resolvedCustomerId =
            typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        }
      }
      if (!resolvedCustomerId)
        return json(404, { error: "Purchase not found" });

      const customer = await stripe.customers
        .retrieve(resolvedCustomerId)
        .catch(() => null);
      if (
        !customer ||
        customer.deleted ||
        (customer.email ?? "").toLowerCase() !== email.toLowerCase()
      ) {
        return json(403, { error: "Purchase does not match this email" });
      }

      const admin = createAdminClient();

      // The wallet identity, stored on the Supabase user. profiles is the RLS
      // source for security-critical state (phone — "captured from wallet
      // checkout"); user_metadata additionally carries the billing address/zip,
      // which the cms.users mirror reads (per docs/ARCHITECTURE.md — one-way
      // Supabase -> Payload sync; profiles has no address column).
      const walletMeta: Record<string, unknown> = {
        ...(name ? { display_name: name } : {}),
        ...(phone ? { phone } : {}),
        ...(postalCode ? { billing_postal_code: postalCode } : {}),
        ...(address ? { billing_address: address } : {}),
      };

      // 1) Account: link an existing one, or invite a new one (sends the email).
      let userId = await findUserIdByEmail(admin, email);
      let existing = userId !== null;
      let created = false;
      if (!userId) {
        const { data, error } = await admin.auth.admin.inviteUserByEmail(
          email,
          {
            redirectTo: `${siteUrl()}/accept-invite`,
            data: walletMeta,
          },
        );
        if (error) {
          // email_exists race → link it; any other error fails so the client
          // falls back to the webhook + "check your email" screen.
          if (error.code === "email_exists" || /already/i.test(error.message)) {
            userId = await findUserIdByEmail(admin, email);
            existing = true;
          } else {
            console.error("[billing] guest invite failed:", error.message);
            return json(502, { error: "Could not create your account." });
          }
        } else {
          userId = data.user.id;
          created = true;
        }
      }
      if (!userId) {
        return json(502, { error: "Could not resolve your account." });
      }

      // The handle_new_user trigger seeds profiles.display_name but NOT phone,
      // so set it here for a brand-new account (profiles is the documented home
      // for the wallet phone). Best-effort; existing accounts are left as-is.
      if (created && phone) {
        const { error: phoneErr } = await admin
          .from("profiles")
          .update({ phone })
          .eq("id", userId);
        if (phoneErr) {
          console.error(
            "[billing] guest profile phone update failed:",
            phoneErr.message,
          );
        }
      }

      // 2) Stamp the user id onto Stripe so the webhook + portal/upgrade resolve
      //    it (the embedded flow never wrote it). Best-effort.
      await stripe.customers
        .update(resolvedCustomerId, { metadata: { supabase_user_id: userId } })
        .catch(() => undefined);
      if (sub) {
        await stripe.subscriptions
          .update(sub.id, {
            metadata: { ...sub.metadata, supabase_user_id: userId },
          })
          .catch(() => undefined);
      }

      // 3) Link billing for RLS clients (idempotent with the webhook).
      await admin
        .from("ext_billing_customers")
        .upsert(
          { user_id: userId, stripe_customer_id: resolvedCustomerId },
          { onConflict: "user_id" },
        );
      if (sub) {
        // Best-effort: a not-yet-synced price mirror (ext_billing_prices) would
        // FK-fail here — the webhook writes this row regardless, so don't block.
        const { error: subErr } = await admin
          .from("ext_billing_subscriptions")
          .upsert(subscriptionRow(sub, userId));
        if (subErr) {
          console.error(
            "[billing] guest subscription mirror failed:",
            subErr.message,
          );
        }
      }

      return Response.json({ ok: true, existing });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not finish setup.";
      console.error("[billing] guest-account failed:", message);
      return json(502, { error: message });
    }
  },

  /**
   * One-click upgrade-in-place from the active (monthly) subscription to the
   * annual plan, using the payment method already on file. Powers the
   * post-purchase upsell screen. The annual plan's intro coupon discounts the
   * immediate invoice, and `proration_behavior: "none"` keeps the already-paid
   * monthly charge intact so the buyer's first-year spend matches the displayed
   * total. The Stripe webhook mirrors the price change into
   * public.ext_billing_subscriptions, flipping gating to the annual price.
   *
   * PUBLIC because the embedded-wallet GUEST upsell has no session (anon
   * sign-in / Turnstile can be unavailable). Ownership is enforced two ways:
   * a signed-in caller must own the subscription via its metadata user id; a
   * guest may only upgrade a STILL-UNLINKED subscription whose Stripe customer
   * email matches the wallet email they pass — i.e. exactly the subscription
   * they just created. The guest-account route (called right after) then links
   * the account; the webhook backstops both.
   */
  "POST /upgrade-annual": async (req, ctx) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      return json(503, { error: "Billing not configured" });
    }
    const parsed = upgradeAnnualSchema.safeParse(await req.json());
    if (!parsed.success) return json(400, { error: "Invalid plan" });
    const { subscriptionId, email } = parsed.data;
    const userId = ctx.user?.id ?? null;

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
      // just created — it works immediately, before the webhook has written the
      // customer mapping. Fall back to the mapping + active-subscription scan
      // (signed-in/portal path only).
      let current: Stripe.Subscription | undefined;
      if (subscriptionId) {
        const sub = await stripe.subscriptions
          .retrieve(subscriptionId)
          .catch(() => null);
        if (sub) {
          // Ownership: a signed-in caller must own the sub via metadata; a guest
          // may only upgrade a still-unlinked sub whose Stripe customer email
          // matches the wallet email (proves this is their just-bought sub).
          let owns = false;
          if (userId) {
            owns = sub.metadata.supabase_user_id === userId;
          } else if (email && !sub.metadata.supabase_user_id) {
            const custId =
              typeof sub.customer === "string" ? sub.customer : sub.customer.id;
            const customer = await stripe.customers
              .retrieve(custId)
              .catch(() => null);
            owns =
              !!customer &&
              !customer.deleted &&
              (customer.email ?? "").toLowerCase() === email.toLowerCase();
          }
          if (owns) {
            if (sub.items.data[0]?.price.id === plan.stripePriceId) {
              return json(409, { error: "Already on the annual plan." });
            }
            if (sub.status === "active" || sub.status === "trialing") {
              current = sub;
            }
          }
        }
      }

      if (!current) {
        // Mapping fallback needs a session (no user id → nothing to look up).
        if (!userId) return json(404, { error: "No billing account" });
        const { data: customer } = await ctx.supabase
          .from("ext_billing_customers")
          .select("stripe_customer_id")
          .eq("user_id", userId)
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

      // Stamp the user id only when known (guest: the guest-account route does
      // it right after, once the account exists).
      const metadata: Record<string, string> = {
        plan_id: String(plan.id),
        ...(userId ? { supabase_user_id: userId } : {}),
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
