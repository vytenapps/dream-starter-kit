import type { CollectionConfig } from "payload";

import { anyone, isAdmin } from "../access";
import { syncCouponAfterChange } from "../hooks/sync-coupon-to-stripe";

/**
 * Discount coupons + (optionally) a customer-facing promotion code. Authored
 * here and synced to Stripe automatically on save (see
 * payload/hooks/sync-coupon-to-stripe.ts + lib/stripe/sync.ts). A coupon is
 * the backend discount definition; a promotion code is the shareable code
 * customers type at checkout that maps to it.
 *
 * Stripe coupons are immutable for amount/duration — changing those creates a
 * NEW Stripe coupon and archives the old one (the sync handles this). Read is
 * public (so the app can surface available offers); writes are staff-only.
 *
 * The `isWelcomeOffer` coupon (at most one active) is what the signup flow uses
 * to generate a unique, expiring promotion code per new free account.
 */
export const Coupons: CollectionConfig = {
  slug: "coupons",
  admin: {
    useAsTitle: "name",
    group: "Commerce",
    defaultColumns: ["name", "discountType", "value", "duration", "syncStatus"],
    description:
      "Discounts synced to Stripe on save. Changing amount/duration creates " +
      "a new Stripe coupon (they're immutable) and archives the old one.",
  },
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: { afterChange: [syncCouponAfterChange] },
  fields: [
    { name: "name", type: "text", required: true },
    {
      type: "row",
      fields: [
        {
          name: "discountType",
          type: "select",
          required: true,
          defaultValue: "percent_off",
          options: [
            { label: "Percent off", value: "percent_off" },
            { label: "Amount off", value: "amount_off" },
          ],
          admin: { width: "40%" },
        },
        {
          name: "value",
          type: "number",
          required: true,
          min: 0,
          admin: {
            width: "30%",
            description: "Percent (1–100) or amount in cents.",
          },
        },
        {
          name: "currency",
          type: "text",
          defaultValue: "usd",
          admin: {
            width: "30%",
            condition: (data) => data.discountType === "amount_off",
          },
        },
      ],
    },

    // --- Duration: once, repeating (N months / N years), or forever ---
    {
      type: "row",
      fields: [
        {
          name: "duration",
          type: "select",
          required: true,
          defaultValue: "once",
          options: [
            { label: "Once (first invoice)", value: "once" },
            { label: "Repeating", value: "repeating" },
            { label: "Forever", value: "forever" },
          ],
          admin: { width: "40%" },
        },
        {
          name: "durationCount",
          type: "number",
          min: 1,
          defaultValue: 1,
          label: "Repeat for",
          admin: {
            width: "30%",
            condition: (data) => data.duration === "repeating",
          },
        },
        {
          name: "durationUnit",
          type: "select",
          defaultValue: "month",
          options: [
            { label: "Months", value: "month" },
            { label: "Years", value: "year" },
          ],
          admin: {
            width: "30%",
            description:
              "Years are converted to months for Stripe (2 years → 24 months).",
            condition: (data) => data.duration === "repeating",
          },
        },
      ],
    },

    {
      type: "row",
      fields: [
        {
          name: "maxRedemptions",
          type: "number",
          min: 1,
          admin: { width: "33%", description: "Total redemptions allowed." },
        },
        {
          name: "redeemBy",
          type: "date",
          label: "Expires on",
          admin: {
            width: "33%",
            date: { pickerAppearance: "dayAndTime" },
            description: "Stripe redeem_by — no new redemptions after this.",
          },
        },
        {
          name: "minimumAmount",
          type: "number",
          min: 0,
          admin: {
            width: "33%",
            description:
              "Optional minimum order amount (cents) — enforced at checkout.",
          },
        },
      ],
    },
    {
      name: "timesRedeemed",
      type: "number",
      defaultValue: 0,
      admin: {
        position: "sidebar",
        readOnly: true,
        description: "Mirrored from Stripe.",
      },
    },
    {
      name: "active",
      type: "checkbox",
      defaultValue: true,
      admin: { position: "sidebar" },
    },
    {
      name: "appliesTo",
      type: "relationship",
      relationTo: "plans",
      hasMany: true,
      admin: {
        description: "Restrict to specific plans (empty = applies to all).",
      },
    },
    {
      name: "code",
      type: "text",
      label: "Promotion code",
      admin: {
        description:
          "Optional customer-facing code (e.g. LAUNCH20). Created as a Stripe " +
          "promotion code on sync. Leave blank for a code-less coupon.",
      },
    },
    {
      name: "isWelcomeOffer",
      type: "checkbox",
      label: "Use as the signup welcome offer",
      defaultValue: false,
      admin: {
        description:
          "When set, new free signups get a unique, expiring promotion code " +
          "for this coupon. Keep at most one active.",
      },
    },

    // --- Stripe sync state (read-only; written by the afterChange sync hook) ---
    {
      name: "skipSync",
      type: "checkbox",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description: "Don't push this coupon to Stripe on save.",
      },
    },
    {
      name: "stripeCouponId",
      type: "text",
      admin: { position: "sidebar", readOnly: true },
    },
    {
      name: "stripePromotionCodeId",
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
  ],
};
