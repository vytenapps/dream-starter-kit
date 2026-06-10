// Stripe webhook → syncs products / prices / customers / subscriptions into the
// DB using the SERVICE ROLE (clients never write billing rows). Signature is
// verified; handlers upsert by primary key so redelivered/out-of-order events
// are idempotent.
//
// config.toml sets verify_jwt = false for this function (Stripe has no Supabase
// JWT). Local: `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook`.
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

const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
          .from("products")
          .upsert(mapProduct(event.data.object as Stripe.Product));
        break;
      }
      case "price.created":
      case "price.updated": {
        await admin
          .from("prices")
          .upsert(mapPrice(event.data.object as Stripe.Price));
        break;
      }
      case "checkout.session.completed": {
        const { userId, customerId } = resolveCheckoutCustomer(
          event.data.object as Stripe.Checkout.Session,
        );
        if (userId && customerId) {
          await admin
            .from("customers")
            .upsert(
              { user_id: userId, stripe_customer_id: customerId },
              { onConflict: "user_id" },
            );
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        let userId = subscriptionUserIdFromMetadata(sub);
        if (!userId) {
          const { data } = await admin
            .from("customers")
            .select("user_id")
            .eq("stripe_customer_id", subscriptionCustomerId(sub))
            .maybeSingle();
          userId = data?.user_id ?? null;
        }
        if (userId) {
          await admin
            .from("subscriptions")
            .upsert(mapSubscription(sub, userId));
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("stripe-webhook handler error", err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
