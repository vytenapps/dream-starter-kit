import { NextResponse } from "next/server";

import { env } from "~/env";
import { getStripe } from "~/lib/stripe";
import { createClient } from "~/lib/supabase/server";

/**
 * The signed-in user's past invoices (for the /billing page). Looks up their
 * Stripe customer from the `customers` table (RLS read-own) and lists invoices.
 * Returns a trimmed, client-safe shape with links to Stripe-hosted PDFs.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ invoices: [] });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: customer } = await supabase
    .from("ext_billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!customer?.stripe_customer_id) {
    return NextResponse.json({ invoices: [] });
  }

  const stripe = getStripe();
  const list = await stripe.invoices.list({
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

  return NextResponse.json({ invoices });
}
