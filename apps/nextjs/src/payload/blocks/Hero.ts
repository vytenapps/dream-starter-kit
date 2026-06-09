import type { Block } from "payload";

import { buttonsField } from "./shared";

/** Launch UI Hero — headline, subcopy, badge, CTAs and an optional screenshot. */
export const HeroBlock: Block = {
  slug: "hero",
  interfaceName: "HeroBlock",
  labels: { singular: "Hero", plural: "Heroes" },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "description", type: "textarea" },
    {
      type: "row",
      fields: [
        {
          name: "badgeText",
          type: "text",
          admin: { width: "50%", description: "Small pill above the title." },
        },
        {
          name: "badgeLinkText",
          type: "text",
          admin: { width: "25%" },
        },
        {
          name: "badgeLinkHref",
          type: "text",
          admin: { width: "25%" },
        },
      ],
    },
    buttonsField(),
    {
      name: "mockupLight",
      type: "upload",
      relationTo: "media",
      admin: { description: "Hero screenshot (light mode)." },
    },
    {
      name: "mockupDark",
      type: "upload",
      relationTo: "media",
      admin: { description: "Optional dark-mode variant of the screenshot." },
    },
  ],
};
