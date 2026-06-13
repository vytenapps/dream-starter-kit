import type { CollectionConfig } from "payload";

import { ownsOrStaff } from "@acme/ext-kit/payload";

/**
 * CMS mirror of Stripe subscriptions, keyed by `stripeSubscriptionID` and
 * written EXCLUSIVELY by the Stripe webhook handler
 * (payload/stripe/webhooks.ts, registered via @payloadcms/plugin-stripe at
 * POST /cms-api/stripe/webhooks) — all client/admin writes are disabled, every
 * field is read-only in the UI. Members read their own rows.
 *
 * This complements (does not replace) `public.subscriptions`, which the
 * Supabase edge webhook keeps for RLS clients and entitlement checks.
 */
export const Subscriptions: CollectionConfig = {
  slug: "ext-billing-subscriptions",
  // Namespaced slug + clean admin label (see Plans.ts).
  labels: { singular: "Billing Subscription", plural: "Billing Subscriptions" },
  admin: {
    group: "Commerce",
    defaultColumns: ["user", "plan", "status", "currentPeriodEnd"],
    description:
      "Read-only mirror written by the Stripe webhook. Manage billing in " +
      "Stripe; author the catalog under Plans.",
    // Read-only mirror; surfaced inline on each Plan (the `subscriptions` join).
    // Every row has a plan, so hide the standalone list to keep Plans the
    // single Commerce entry point. A member's subscriptions also show on Users.
    hidden: true,
  },
  disableDuplicate: true,
  access: {
    read: ownsOrStaff(),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      index: true,
      admin: { readOnly: true },
    },
    {
      name: "plan",
      type: "relationship",
      relationTo: "ext-billing-plans",
      index: true,
      admin: { readOnly: true },
    },
    {
      name: "coupon",
      type: "relationship",
      relationTo: "ext-billing-coupons",
      admin: { readOnly: true },
    },
    {
      name: "status",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Trialing", value: "trialing" },
        { label: "Active", value: "active" },
        { label: "Past due", value: "past_due" },
        { label: "Canceled", value: "canceled" },
        { label: "Churned", value: "churned" },
        { label: "Paused", value: "paused" },
      ],
      admin: { readOnly: true },
    },
    { name: "startedAt", type: "date", admin: { readOnly: true } },
    { name: "trialEndsAt", type: "date", admin: { readOnly: true } },
    { name: "currentPeriodStart", type: "date", admin: { readOnly: true } },
    { name: "currentPeriodEnd", type: "date", admin: { readOnly: true } },
    {
      name: "cancelAtPeriodEnd",
      type: "checkbox",
      defaultValue: false,
      admin: { readOnly: true },
    },
    { name: "canceledAt", type: "date", admin: { readOnly: true } },
    { name: "lastPaymentAt", type: "date", admin: { readOnly: true } },
    {
      name: "lastPaymentAmount",
      type: "number",
      admin: { readOnly: true, description: "Cents." },
    },
    {
      name: "stripeSubscriptionID",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true },
    },
    {
      name: "stripeCustomerID",
      type: "text",
      index: true,
      admin: { readOnly: true },
    },
  ],
};
