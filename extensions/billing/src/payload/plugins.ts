import type { Config } from "payload";
import { stripePlugin } from "@payloadcms/plugin-stripe";

import { syncSubscriptionFromStripe } from "./webhooks";

/**
 * Stripe: the plugin provides the signed webhook endpoint
 * (POST /cms-api/stripe/webhooks) that mirrors subscriptions into the CMS
 * (./webhooks.ts). NO declarative `sync` config on purpose — it can't express
 * immutable price recreate-and-archive or intro coupons, so plans/coupons
 * sync via their afterChange hooks instead (./hooks/sync-*-to-stripe.ts).
 * The REST proxy stays off. Merged into the host's plugins array via the
 * generated payload registry (the widest extension power — §3.2).
 */
export const plugins: NonNullable<Config["plugins"]> = [
  stripePlugin({
    // Placeholder when unconfigured: webhook SIGNATURE verification only
    // needs the endpoint secret, but stripe v22's constructor rejects an
    // empty key outright. API calls with the placeholder fail loudly (and
    // the mirror handler catches its optional customer lookup).
    stripeSecretKey:
      process.env.STRIPE_SECRET_KEY ?? "sk_test_unconfigured_placeholder",
    isTestKey: (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test"),
    stripeWebhooksEndpointSecret: process.env.STRIPE_WEBHOOKS_ENDPOINT_SECRET,
    rest: false,
    webhooks: {
      "customer.subscription.created": syncSubscriptionFromStripe,
      "customer.subscription.updated": syncSubscriptionFromStripe,
      "customer.subscription.deleted": syncSubscriptionFromStripe,
    },
  }),
];
