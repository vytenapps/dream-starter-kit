// Account deletion (App Store requirement: deletion must be available in-app).
//
// Verifies the caller's JWT, then uses the SERVICE ROLE to delete the auth user.
// The DB ON DELETE CASCADE chain (profiles -> everything owned) removes all of
// their data. Stripe subscription cancellation is added in Phase 5 (guarded by
// the presence of a customers row).
//
// Local: `supabase functions serve delete-account` (SUPABASE_URL / ANON_KEY /
// SERVICE_ROLE_KEY are injected automatically). Deploy: `supabase functions
// deploy delete-account`.
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@22";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "Server misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  // Identify the caller from their access token.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);

  // Service-role client bypasses RLS to delete the auth user.
  const admin = createClient(supabaseUrl, serviceKey);

  // Best-effort: cancel the live Stripe subscription(s) before deleting the
  // account (the DB cascade only removes our mirror rows, not Stripe state).
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  if (stripeSecret) {
    try {
      const { data: customer } = await admin
        .from("customers")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (customer?.stripe_customer_id) {
        const stripe = new Stripe(stripeSecret);
        const subs = await stripe.subscriptions.list({
          customer: customer.stripe_customer_id,
          status: "all",
        });
        await Promise.all(
          subs.data
            .filter((s) => s.status !== "canceled")
            .map((s) => stripe.subscriptions.cancel(s.id)),
        );
      }
    } catch (err) {
      // Don't block account deletion on Stripe errors — log and continue.
      console.error("delete-account: Stripe cleanup failed", err);
    }
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) return json({ error: delErr.message }, 500);

  return json({ success: true }, 200);
});
