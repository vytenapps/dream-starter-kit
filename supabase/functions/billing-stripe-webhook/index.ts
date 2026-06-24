import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@22";

import {
  mapPrice,
  mapProduct,
  mapSubscription,
  resolveCheckoutCustomer,
  subscriptionCustomerId,
  subscriptionUserIdFromMetadata,
} from "./mapping.ts";

// Stripe webhook → syncs products / prices / customers / subscriptions into the
// DB using the SERVICE ROLE (clients never write billing rows). Signature is
// verified; handlers upsert by primary key so redelivered/out-of-order events
// are idempotent.
//
// It also drives the "checkout-first" signup flow: when an anonymous visitor
// pays, this matches the checkout email to an existing user (and attaches the
// subscription) or creates the account and emails a Supabase invite. Active
// plans tag the user with the plan name (public.user_tags).
//
// config.toml sets verify_jwt = false for this function (Stripe has no Supabase
// JWT). Local: `stripe listen --forward-to localhost:54321/functions/v1/billing-stripe-webhook`.

const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
// Where guest invitees set their password. Must be an allowed Supabase redirect.
const siteUrl =
  Deno.env.get("SITE_URL") ??
  Deno.env.get("NEXT_PUBLIC_APP_URL") ??
  "http://localhost:3000";

/** Find an auth user id by email (paged scan — fine at starter-kit scale). */
async function findUserIdByEmail(
  admin: SupabaseClient,
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

/**
 * Resolve the buyer to a Supabase user id for a guest checkout: match an
 * existing account by email, else create one and email a Supabase invite (the
 * invitee sets a password on /accept-invite, then lands on /a).
 */
async function resolveOrInviteGuest(
  admin: SupabaseClient,
  email: string,
  displayName: string | null,
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/accept-invite`,
    data: displayName ? { display_name: displayName } : undefined,
  });
  if (!error) return data.user?.id ?? null;
  // Already an app user → link to the existing account (no email sent).
  if (error.code === "email_exists" || /already/i.test(error.message)) {
    return await findUserIdByEmail(admin, email);
  }
  console.error("guest invite failed", error);
  return null;
}

/** Tag the user with their plan name (price → product → name). Idempotent. */
async function ensurePlanTag(
  admin: SupabaseClient,
  userId: string,
  priceId: string | null,
): Promise<void> {
  if (!priceId) return;
  const { data: price } = await admin
    .from("ext_billing_prices")
    .select("product_id")
    .eq("id", priceId)
    .maybeSingle();
  if (!price?.product_id) return;
  const { data: product } = await admin
    .from("ext_billing_products")
    .select("name")
    .eq("id", price.product_id)
    .maybeSingle();
  const name = product?.name;
  if (!name) return;
  const { data: tag } = await admin
    .from("tags")
    .upsert({ name, is_system: true }, { onConflict: "name" })
    .select("id")
    .maybeSingle();
  if (!tag?.id) return;
  await admin
    .from("user_tags")
    .upsert(
      { user_id: userId, tag_id: tag.id },
      { onConflict: "user_id,tag_id" },
    );
}

/**
 * Convert an anonymous buyer (who favorited → got an anon account → checked out)
 * to a permanent account, or merge into the existing account that owns the email.
 * Hosted Checkout redirects away, so the client-side email-confirmation flow
 * can't run here — the completed redirect is strong intent, so we set+confirm the
 * email directly. Returns the effective userId for the rest of the handler.
 */
async function convertOrMergeAnon(
  admin: SupabaseClient,
  anonId: string,
  email: string,
): Promise<string> {
  const { data: got } = await admin.auth.admin.getUserById(anonId);
  if (!got.user?.is_anonymous) return anonId; // already permanent

  const existingId = await findUserIdByEmail(admin, email);
  if (existingId && existingId !== anonId) {
    // Merge billing into the existing account, then delete the anon user.
    await admin
      .from("ext_billing_subscriptions")
      .update({ user_id: existingId })
      .eq("user_id", anonId);
    const { data: realCust } = await admin
      .from("ext_billing_customers")
      .select("user_id")
      .eq("user_id", existingId)
      .maybeSingle();
    if (realCust) {
      await admin.from("ext_billing_customers").delete().eq("user_id", anonId);
    } else {
      await admin
        .from("ext_billing_customers")
        .update({ user_id: existingId })
        .eq("user_id", anonId);
    }
    await admin.auth.admin.deleteUser(anonId);
    return existingId;
  }
  await admin.auth.admin.updateUserById(anonId, { email, email_confirm: true });
  return anonId;
}

/** Name/email/phone/address from Checkout `customer_details` OR a charge's
 *  `billing_details` — structurally the same shape. */
interface BuyerContact {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: Stripe.Address | null;
}

/** Persist the buyer's captured identity to their profile + Stripe customer. */
async function persistBuyerDetails(
  admin: SupabaseClient,
  stripe: Stripe,
  userId: string,
  customerId: string | undefined,
  details: BuyerContact | null,
): Promise<void> {
  if (!details) return;
  const patch: Record<string, string> = {};
  if (details.name) patch.display_name = details.name;
  if (details.phone) patch.phone = details.phone;
  if (Object.keys(patch).length) {
    await admin.from("profiles").update(patch).eq("id", userId);
  }
  // Stamp the captured identity into auth user_metadata — the carrier the
  // cms.users mirror reads (the billing zip has no profiles column). Mirrors
  // what the /guest-account route writes, so the webhook-only path still syncs
  // name/phone/zip to Payload on the user's next login. GoTrue merges
  // user_metadata, so other keys are preserved. Best-effort.
  const meta: Record<string, unknown> = {};
  if (details.name) meta.display_name = details.name;
  if (details.phone) meta.phone = details.phone;
  if (details.address?.postal_code) {
    meta.billing_postal_code = details.address.postal_code;
  }
  if (details.address) meta.billing_address = details.address;
  if (Object.keys(meta).length) {
    await admin.auth.admin
      .updateUserById(userId, { user_metadata: meta })
      .then(undefined, () => undefined);
  }
  if (customerId) {
    await stripe.customers
      .update(customerId, {
        name: details.name ?? undefined,
        email: details.email ?? undefined,
        phone: details.phone ?? undefined,
        address: details.address ?? undefined,
      })
      .catch(() => undefined);
  }
}

/**
 * Embedded checkout (express-intent) fires no `checkout.session.completed`, so
 * pull the buyer's identity off the subscription's most recent charge
 * (`billing_details`, captured from the wallet) and persist it the same way.
 */
async function persistFromLatestCharge(
  admin: SupabaseClient,
  stripe: Stripe,
  userId: string,
  customerId: string,
): Promise<void> {
  const charges = await stripe.charges.list({ customer: customerId, limit: 1 });
  const bd = charges.data[0]?.billing_details ?? null;
  if (bd) await persistBuyerDetails(admin, stripe, userId, customerId, bd);
}

Deno.serve(async (req) => {
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  if (!stripeSecret || !webhookSecret || !supabaseUrl || !serviceKey) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const stripe = new Stripe(stripeSecret);
  const admin = createClient(supabaseUrl, serviceKey);

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    // Async variant is required in Deno/edge (no Node crypto).
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      webhookSecret,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return new Response(`Signature verification failed: ${message}`, {
      status: 400,
    });
  }

  try {
    switch (event.type) {
      case "product.created":
      case "product.updated": {
        await admin
          .from("ext_billing_products")
          .upsert(mapProduct(event.data.object as Stripe.Product));
        break;
      }
      case "price.created":
      case "price.updated": {
        await admin
          .from("ext_billing_prices")
          .upsert(mapPrice(event.data.object as Stripe.Price));
        break;
      }
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const { userId: refUserId, customerId } =
          resolveCheckoutCustomer(session);

        // Guest checkout: no app user referenced → match by email or create one.
        let userId = refUserId;
        const email = session.customer_details?.email ?? null;
        if (!userId && email) {
          userId = await resolveOrInviteGuest(
            admin,
            email,
            session.customer_details?.name ?? null,
          );
        }

        // Anonymous buyer (anon account from a favorite) → convert/merge here.
        if (userId && email) {
          userId = await convertOrMergeAnon(admin, userId, email);
        }
        // Persist captured identity (name/phone/address) to profile + customer.
        if (userId) {
          await persistBuyerDetails(
            admin,
            stripe,
            userId,
            customerId,
            session.customer_details,
          );
        }

        if (userId && customerId) {
          await admin
            .from("ext_billing_customers")
            .upsert(
              { user_id: userId, stripe_customer_id: customerId },
              { onConflict: "user_id" },
            );
        }

        // One-time (lifetime) purchases create no subscription, so record an
        // active row keyed by the session id to unlock premium, and tag the user.
        if (userId && session.mode === "payment") {
          const items = await stripe.checkout.sessions.listLineItems(
            session.id,
            { limit: 1 },
          );
          const priceId = items.data[0]?.price?.id ?? null;
          if (priceId) {
            await admin.from("ext_billing_subscriptions").upsert({
              id: session.id,
              user_id: userId,
              price_id: priceId,
              status: "active",
              quantity: 1,
              cancel_at_period_end: false,
              current_period_end: null,
            });
            await ensurePlanTag(admin, userId, priceId);
          }
        }

        // Subscription mode: persist the subscription here too (not just from the
        // customer.subscription.* event), so guest checkouts link correctly
        // regardless of Stripe's event ordering.
        if (userId && session.mode === "subscription" && session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          await admin
            .from("ext_billing_subscriptions")
            .upsert(mapSubscription(sub, userId));
          if (sub.status === "active" || sub.status === "trialing") {
            await ensurePlanTag(
              admin,
              userId,
              sub.items.data[0]?.price.id ?? null,
            );
          }
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = subscriptionCustomerId(sub);
        let userId = subscriptionUserIdFromMetadata(sub);
        if (!userId) {
          const { data } = await admin
            .from("ext_billing_customers")
            .select("user_id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          userId = data?.user_id ?? null;
        }
        // Guest who paid via the EMBEDDED wallet flow without an anonymous
        // session: no metadata user, no mapping yet. Match the customer's email
        // to an account (or create one + email an invite), same as guest
        // Checkout. Not for the deleted event (don't resurrect accounts). The
        // host's /api/ext/billing/guest-account route is the primary, synchronous
        // path (it runs at "Continue"/"Maybe later"); this is the idempotent
        // backstop for when that call didn't run or didn't land.
        if (!userId && event.type !== "customer.subscription.deleted") {
          const customer = await stripe.customers.retrieve(customerId);
          if (!customer.deleted && customer.email) {
            userId = await resolveOrInviteGuest(
              admin,
              customer.email,
              customer.name ?? null,
            );
          }
        }
        if (userId) {
          // Persist the customer mapping so later portal/upgrade calls resolve
          // it (checkout.session.completed isn't fired by the embedded flow).
          await admin
            .from("ext_billing_customers")
            .upsert(
              { user_id: userId, stripe_customer_id: customerId },
              { onConflict: "user_id" },
            );
          await admin
            .from("ext_billing_subscriptions")
            .upsert(mapSubscription(sub, userId));
          if (sub.status === "active" || sub.status === "trialing") {
            await ensurePlanTag(
              admin,
              userId,
              sub.items.data[0]?.price.id ?? null,
            );
          }
          // Embedded checkout has no checkout.session — capture the buyer's
          // identity from the first charge on creation.
          if (event.type === "customer.subscription.created") {
            await persistFromLatestCharge(admin, stripe, userId, customerId);
          }
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("billing-stripe-webhook handler error", err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
