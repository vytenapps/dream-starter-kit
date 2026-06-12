import { defineExtensionSettings } from "@acme/ext-kit/payload";

import { linkField } from "./fields/link";

/**
 * Billing's admin settings screen (§1.7) — the former PricingSettings global,
 * now `ext-billing-settings` under the Extensions group. Controls what the
 * public /pricing page shows: staff curate up to three paid plans to feature
 * and whether to show the Free tier column. publicRead: the pricing page (and
 * the native app) read it anonymously — never put secrets here.
 */
export const settings = defineExtensionSettings({
  slug: "billing",
  name: "Billing",
  publicRead: true,
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
      name: "billingToggleDefault",
      type: "radio",
      defaultValue: "monthly",
      options: [
        { label: "Monthly", value: "monthly" },
        { label: "Annual", value: "annual" },
      ],
      admin: {
        description: "Which billing cadence the pricing page preselects.",
      },
    },
    {
      name: "featuredPlans",
      type: "relationship",
      relationTo: "ext-billing-plans",
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
        linkField("link", {
          description: "Where the Free tier CTA goes (defaults to /sign-up).",
        }),
        {
          name: "features",
          type: "array",
          fields: [
            { name: "text", type: "text", required: true },
            { name: "included", type: "checkbox", defaultValue: true },
          ],
        },
      ],
    },
    {
      name: "disclaimer",
      type: "textarea",
      admin: { description: "Fine print shown under the pricing grid." },
    },
  ],
});
