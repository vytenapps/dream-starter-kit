import { defineExtension } from "@acme/ext-kit";

/**
 * Billing — Stripe-only payments (golden rule #4): plan-driven web checkout
 * (incl. guest checkout via the public route), customer portal, invoices, the
 * billing-stripe-webhook edge function mirroring Stripe state into
 * ext_billing_* for RLS clients, the Payload plans/coupons catalog +
 * subscriptions mirror (Commerce admin group) and the stripePlugin. The
 * pricing page is curated from billing's admin settings screen
 * (ext-billing-settings). Mobile reads the subscriptions mirror read-own —
 * no IAP.
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
  nav: {
    web: [
      { title: "Billing", href: "/billing", icon: "IconCreditCard", order: 50 },
    ],
    native: [{ title: "Pricing", href: "/x/billing", order: 55 }],
  },
  routes: {
    web: [
      { path: "", component: "BillingPage", mount: "/billing" },
      {
        path: "",
        component: "PricingPage",
        area: "public",
        mount: "/pricing",
        rsc: true,
      },
    ],
    native: [{ path: "", component: "PricingScreen" }],
  },
  widgets: { web: "BillingWidget", native: "BillingWidget" },
  server: {
    routes: true,
    publicRoutes: true,
    edgeFunctions: ["billing-stripe-webhook"],
  },
  database: {
    tables: [
      "ext_billing_customers",
      "ext_billing_products",
      "ext_billing_prices",
      "ext_billing_subscriptions",
    ],
    dml: ["tags", "user_tags"],
  },
  cms: {
    collections: [
      "ext-billing-plans",
      "ext-billing-coupons",
      "ext-billing-subscriptions",
    ],
    hasPlugins: true,
    hasMigrations: true,
    hasSeed: true,
    hasSettings: true,
  },
});
