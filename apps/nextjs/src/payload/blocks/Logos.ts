import type { Block } from "payload";

/** Launch UI Logos — a "trusted by / built with" row of brand marks. */
export const LogosBlock: Block = {
  slug: "logos",
  interfaceName: "LogosBlock",
  labels: { singular: "Logos", plural: "Logos" },
  fields: [
    { name: "title", type: "text" },
    { name: "badgeText", type: "text" },
    {
      name: "logos",
      type: "array",
      fields: [
        { name: "name", type: "text", required: true },
        {
          name: "image",
          type: "upload",
          relationTo: "media",
          admin: {
            description: "Optional logo image; falls back to the name.",
          },
        },
      ],
    },
  ],
};
