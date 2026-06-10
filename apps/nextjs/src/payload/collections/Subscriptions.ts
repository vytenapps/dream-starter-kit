import type { CollectionConfig } from "payload";

import { ownsOrStaff } from "../access";

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
  slug: "subscriptions",
  admin: {
    group: "Commerce",
    defaultColumns: ["user", "plan", "status", "currentPeriodEnd"],
    description:
      "Read-only mirror written by the Stripe webhook. Manage billing in " +
      "Stripe; author the catalog under Plans.",
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
      relationTo: "plans",
      index: true,
      admin: { readOnly: true },
    },
    {
      name: "coupon",
      type: "relationship",
      relationTo: "coupons",
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
