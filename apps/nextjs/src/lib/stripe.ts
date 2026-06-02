import Stripe from "stripe";

import { env } from "~/env";

/**
 * Server-only Stripe client. Throws if billing isn't configured so callers can
 * return a clean 503 (STRIPE_SECRET_KEY is optional until you wire Stripe up).
 */
export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured (STRIPE_SECRET_KEY is missing)");
  }
  return new Stripe(env.STRIPE_SECRET_KEY);
}
