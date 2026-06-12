import { createClient } from "@supabase/supabase-js";

import type { Database } from "@acme/api";

/**
 * Service-role Supabase client — BYPASSES RLS (golden rule #2: server-only;
 * this module is reachable only from ./server and ./payload). Used by the
 * subscriptions-mirror webhook to resolve a Stripe customer to a user via
 * ext_billing_customers. Reads core env validated by the host's zod schema.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) must be set " +
        "for the billing webhook's customer lookup — see .env.example.",
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
