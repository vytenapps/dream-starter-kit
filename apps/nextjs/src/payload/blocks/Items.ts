import type { Block } from "payload";

import { iconField } from "./shared";

/** Launch UI Items — a titled grid of feature cards (icon + title + text). */
export const ItemsBlock: Block = {
  slug: "items",
  interfaceName: "ItemsBlock",
  labels: { singular: "Features (Items)", plural: "Features (Items)" },
  fields: [
    { name: "title", type: "text" },
    {
      name: "items",
      type: "array",
      minRows: 1,
      fields: [
        { name: "title", type: "text", required: true },
        { name: "description", type: "textarea", required: true },
        {
          name: "tooltip",
          type: "textarea",
          admin: {
            description:
              "Optional deeper detail, shown in an (i) tooltip next to the " +
              "card title. Use it for the technical specifics behind the " +
              "plain-English description.",
          },
        },
        iconField(),
      ],
    },
  ],
};
