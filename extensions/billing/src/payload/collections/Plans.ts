import type { CollectionConfig } from "payload";

import { anyone, isAdmin } from "@acme/ext-kit/payload";

import { slugField } from "../fields/slug";
import { syncPlanAfterChange } from "../hooks/sync-plan-to-stripe";

/**
 * Billing plans — the source of truth for the product catalog. Authored here
 * in Payload (the `cms` schema) and synced to Stripe automatically on save
 * (see payload/hooks/sync-plan-to-stripe.ts + lib/stripe/sync.ts). The Stripe
 * webhook mirrors the resulting products/prices back into the RLS-governed
 * `public.products`/`public.prices` tables so clients can read the catalog.
 * The read-only `stripe*` fields below are written back by the sync; never
 * hand-edit them.
 *
 * Pricing is NOT editorial, so there is no draft/publish workflow — `active`
 * gates visibility instead. Read is public (the pricing page is anonymous);
 * writes are admin-only.
 */
export const Plans: CollectionConfig = {
  slug: "ext-billing-plans",
  admin: {
    useAsTitle: "name",
    group: "Commerce",
    defaultColumns: [
      "name",
      "pricingType",
      "unitAmount",
      "active",
      "syncStatus",
    ],
    description:
      "Plans sync to Stripe automatically on save. Stripe prices are " +
      "immutable, so changing the amount creates a new price and archives " +
      "the old one.",
  },
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: { afterChange: [syncPlanAfterChange] },
  fields: [
    {
      type: "row",
      fields: [
        {
          name: "name",
          type: "text",
          required: true,
          admin: { width: "60%" },
        },
        {
          name: "active",
          type: "checkbox",
          defaultValue: true,
          admin: { width: "40%" },
        },
      ],
    },
    slugField("name"),
    { name: "description", type: "textarea" },
    {
      type: "row",
      fields: [
        {
          name: "pricingType",
          type: "select",
          required: true,
          defaultValue: "recurring",
          options: [
            { label: "Recurring (subscription)", value: "recurring" },
            { label: "One-time (lifetime)", value: "one_time" },
          ],
          admin: { width: "50%" },
        },
        {
          name: "interval",
          type: "select",
          defaultValue: "month",
          options: [
            { label: "Daily", value: "day" },
            { label: "Weekly", value: "week" },
            { label: "Monthly", value: "month" },
            { label: "Yearly", value: "year" },
          ],
          admin: {
            width: "25%",
            // Only meaningful for recurring plans.
            condition: (data) => data.pricingType === "recurring",
          },
        },
        {
          name: "intervalCount",
          type: "number",
          min: 1,
          defaultValue: 1,
          admin: {
            width: "25%",
            description: "Bill every N intervals, e.g. every 3 months.",
            condition: (data) => data.pricingType === "recurring",
          },
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "unitAmount",
          type: "number",
          required: true,
          min: 0,
          label: "Price (in cents)",
          admin: {
            width: "50%",
            description:
              "Amount in the smallest currency unit, e.g. 999 = $9.99.",
          },
        },
        {
          name: "currency",
          type: "text",
          required: true,
          defaultValue: "usd",
          admin: { width: "25%", description: "ISO code, e.g. usd." },
        },
        {
          name: "trialDays",
          type: "number",
          min: 0,
          label: "Free trial (days)",
          admin: {
            width: "25%",
            description: "0 / empty = no trial.",
            condition: (data) => data.pricingType === "recurring",
          },
        },
      ],
    },
    {
      name: "introOffer",
      type: "group",
      label: "Introductory offer",
      admin: {
        description:
          "Discount the first billing period only (e.g. $1.99 first month, " +
          "then the standard price recurs). Implemented as a Stripe coupon with " +
          "duration=once, applied automatically at checkout.",
        condition: (data) => data.pricingType === "recurring",
      },
      fields: [
        { name: "enabled", type: "checkbox", defaultValue: false },
        {
          name: "introAmount",
          type: "number",
          min: 0,
          label: "Intro price (in cents)",
          admin: {
            description: "Intro-period price, e.g. 199 = $1.99.",
            condition: (_data, sibling) => Boolean(sibling.enabled),
          },
        },
        {
          type: "row",
          fields: [
            {
              name: "introInterval",
              type: "select",
              defaultValue: "month",
              options: [
                { label: "Months", value: "month" },
                { label: "Years", value: "year" },
              ],
              admin: {
                condition: (_data, sibling) => Boolean(sibling.enabled),
              },
            },
            {
              name: "introPeriods",
              type: "number",
              min: 1,
              defaultValue: 1,
              admin: {
                description:
                  "How many intro periods the discount lasts (1 = first " +
                  "invoice only; years count as 12 months each).",
                condition: (_data, sibling) => Boolean(sibling.enabled),
              },
            },
          ],
        },
      ],
    },
    {
      name: "entitlement",
      type: "select",
      defaultValue: "premium",
      options: [
        { label: "Members", value: "members" },
        { label: "Premium", value: "premium" },
      ],
      admin: {
        position: "sidebar",
        description: "Content accessLevel this plan unlocks.",
      },
    },
    {
      name: "features",
      type: "array",
      label: "Feature bullets",
      admin: { description: "Shown on the public pricing card." },
      fields: [
        { name: "text", type: "text", required: true },
        { name: "included", type: "checkbox", defaultValue: true },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "badge",
          type: "text",
          admin: {
            width: "40%",
            description: 'e.g. "Save 17%" or "Best value".',
          },
        },
        {
          name: "highlighted",
          type: "checkbox",
          label: "Highlight this plan",
          defaultValue: false,
          admin: { width: "30%" },
        },
        {
          name: "displayOrder",
          type: "number",
          defaultValue: 0,
          admin: { width: "30%" },
        },
      ],
    },

    // --- Stripe sync state (read-only; written by the afterChange sync hook) ---
    {
      name: "skipSync",
      type: "checkbox",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description: "Don't push this plan to Stripe on save.",
      },
    },
    {
      name: "stripeProductId",
      type: "text",
      admin: { position: "sidebar", readOnly: true },
    },
    {
      name: "stripePriceId",
      type: "text",
      admin: { position: "sidebar", readOnly: true },
    },
    {
      name: "stripeIntroCouponId",
      type: "text",
      admin: { position: "sidebar", readOnly: true },
    },
    {
      name: "syncStatus",
      type: "select",
      defaultValue: "unsynced",
      options: [
        { label: "Not synced", value: "unsynced" },
        { label: "Synced", value: "synced" },
        { label: "Error", value: "error" },
      ],
      admin: { position: "sidebar", readOnly: true },
    },
    {
      name: "syncError",
      type: "textarea",
      admin: {
        position: "sidebar",
        readOnly: true,
        condition: (data) => data.syncStatus === "error",
      },
    },
    {
      name: "lastSyncedAt",
      type: "date",
      admin: {
        position: "sidebar",
        readOnly: true,
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "subscriptions",
      type: "join",
      collection: "ext-billing-subscriptions",
      on: "plan",
    },
  ],
};
