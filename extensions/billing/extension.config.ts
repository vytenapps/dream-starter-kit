import { defineExtension } from "@acme/ext-kit";

/**
 * Billing — Stripe-only payments (golden rule #4): web checkout + portal, the
 * billing-stripe-webhook edge function mirroring products/prices/customers/
 * subscriptions into ext_billing_* for RLS clients, and (from phase 7 of the
 * refactor) the Payload plans/coupons catalog + plugin. Mobile reads the
 * ext_billing_subscriptions mirror read-own — no IAP.
 *
 * database.dml: the webhook auto-tags users by plan name in the core
 * tags/user_tags tables (core DML whitelist).
 */
export default defineExtension({
  slug: "billing",
  name: "Billing",
  version: "1.0.0",
  kitCompat: ">=1.0.0 <2",
  description: "Stripe subscriptions: checkout, portal, webhook mirror.",
  database: {
    tables: [
      "ext_billing_customers",
      "ext_billing_products",
      "ext_billing_prices",
      "ext_billing_subscriptions",
    ],
    dml: ["tags", "user_tags"],
  },
  server: {
    edgeFunctions: ["billing-stripe-webhook"],
  },
});
