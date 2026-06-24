"use client";

import type { Stripe } from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js";

import { env } from "~/env";

let promise: Promise<Stripe | null> | null = null;

/** Lazily load Stripe.js once with the publishable key (client-safe). */
export function getStripePromise(): Promise<Stripe | null> {
  const key = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return Promise.resolve(null);
  promise ??= loadStripe(key);
  return promise;
}

/** Presentation of the paywall: full-screen, bottom sheet, or on-page dock. */
export type CheckoutVariant = "full" | "sheet" | "dock";
