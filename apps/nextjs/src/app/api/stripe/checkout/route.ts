import { NextResponse } from "next/server";
import { z } from "zod/v4";

import { env } from "~/env";
import { getStripe } from "~/lib/stripe";
import { createClient } from "~/lib/supabase/server";

const bodySchema = z.object({ plan: z.enum(["monthly", "yearly"]) });

/**
 * Create a Stripe Checkout session for the chosen plan. Authed; the price ids
 * stay server-side. The webhook persists the customer/subscription rows.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const priceId =
    parsed.data.plan === "monthly"
      ? env.STRIPE_PRICE_MONTHLY
      : env.STRIPE_PRICE_YEARLY;
  if (!priceId || !env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  }

  const stripe = getStripe();

  // Reuse the user's Stripe customer if we have one (the webhook persists it);
  // otherwise reuse by email or create a fresh customer.
  const { data: existing } = await supabase
    .from("customers")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let customerId = existing?.stripe_customer_id;
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

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: user.id,
    subscription_data: { metadata: { supabase_user_id: user.id } },
    success_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
