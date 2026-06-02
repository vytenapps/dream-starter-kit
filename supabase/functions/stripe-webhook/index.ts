// Stripe webhook → syncs products / prices / customers / subscriptions into the
// DB using the SERVICE ROLE (clients never write billing rows). Signature is
// verified; handlers upsert by primary key so redelivered/out-of-order events
// are idempotent.
//
// config.toml sets verify_jwt = false for this function (Stripe has no Supabase
// JWT). Local: `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook`.
import Stripe from "npm:stripe@22";
import { createClient } from "jsr:@supabase/supabase-js@2";

const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
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
    event = await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return new Response(`Signature verification failed: ${message}`, { status: 400 });
  }

  const isoOrNull = (seconds: number | null | undefined) =>
    typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;

  try {
    switch (event.type) {
      case "product.created":
      case "product.updated": {
        const p = event.data.object as Stripe.Product;
        await admin.from("products").upsert({
          id: p.id,
          active: p.active,
          name: p.name,
          description: p.description ?? null,
          image: p.images?.[0] ?? null,
          metadata: p.metadata,
        });
        break;
      }
      case "price.created":
      case "price.updated": {
        const pr = event.data.object as Stripe.Price;
        await admin.from("prices").upsert({
          id: pr.id,
          product_id: typeof pr.product === "string" ? pr.product : pr.product.id,
          active: pr.active,
          unit_amount: pr.unit_amount,
          currency: pr.currency,
          type: pr.type,
          interval: pr.recurring?.interval ?? null,
          interval_count: pr.recurring?.interval_count ?? null,
          metadata: pr.metadata,
        });
        break;
      }
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const userId = s.client_reference_id ?? s.metadata?.supabase_user_id ?? null;
        const customerId = typeof s.customer === "string" ? s.customer : (s.customer?.id ?? null);
        if (userId && customerId) {
          await admin
            .from("customers")
            .upsert({ user_id: userId, stripe_customer_id: customerId }, { onConflict: "user_id" });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        let userId = sub.metadata?.supabase_user_id ?? null;
        if (!userId) {
          const { data } = await admin
            .from("customers")
            .select("user_id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          userId = data?.user_id ?? null;
        }
        if (userId) {
          const item = sub.items.data[0];
          await admin.from("subscriptions").upsert({
            id: sub.id,
            user_id: userId,
            price_id: item?.price.id ?? null,
            status: sub.status,
            quantity: item?.quantity ?? null,
            cancel_at_period_end: sub.cancel_at_period_end,
            // current_period_end moved onto the subscription item in recent API versions.
            current_period_end:
              isoOrNull((item as { current_period_end?: number })?.current_period_end) ??
              isoOrNull((sub as unknown as { current_period_end?: number }).current_period_end),
          });
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
