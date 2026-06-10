import type { GlobalConfig } from "payload";

import { anyone, isStaff } from "../access";

/**
 * Controls what the public /pricing page shows. Staff curate up to three paid
 * plans to feature (between Monthly / Annual / Lifetime) and whether to show the
 * Free tier column. If `featuredPlans` is empty, the pricing page falls back to
 * all active plans ordered by `displayOrder`. Read is public; updates staff-only.
 */
export const PricingSettings: GlobalConfig = {
  slug: "pricing-settings",
  label: "Pricing Page",
  admin: { group: "Payments" },
  access: { read: anyone, update: isStaff },
  fields: [
    {
      type: "row",
      fields: [
        {
          name: "heading",
          type: "text",
          defaultValue: "Pricing",
          admin: { width: "50%" },
        },
        {
          name: "showFreeTier",
          type: "checkbox",
          label: "Show Free tier",
          defaultValue: true,
          admin: { width: "50%" },
        },
      ],
    },
    {
      name: "subheading",
      type: "textarea",
      defaultValue: "Start free. Upgrade when you're ready.",
    },
    {
      name: "featuredPlans",
      type: "relationship",
      relationTo: "plans",
      hasMany: true,
      maxRows: 3,
      admin: {
        description:
          "Pick up to three paid plans to feature, in display order. " +
          "Empty = all active plans by display order.",
      },
    },
    {
      name: "freeTier",
      type: "group",
      label: "Free tier card",
      admin: { condition: (data) => Boolean(data.showFreeTier) },
      fields: [
        { name: "name", type: "text", defaultValue: "Free" },
        {
          name: "description",
          type: "textarea",
          defaultValue: "Everything you need to get started.",
        },
        {
          name: "ctaLabel",
          type: "text",
          defaultValue: "Get started",
        },
        {
          name: "features",
          type: "array",
          fields: [{ name: "text", type: "text", required: true }],
        },
      ],
    },
  ],
};
