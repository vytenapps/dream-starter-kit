import type { Block } from "payload";

/** Launch UI Stats — a row of headline numbers with labels/descriptions. */
export const StatsBlock: Block = {
  slug: "stats",
  interfaceName: "StatsBlock",
  labels: { singular: "Stats", plural: "Stats" },
  fields: [
    {
      name: "items",
      type: "array",
      minRows: 1,
      maxRows: 4,
      fields: [
        {
          type: "row",
          fields: [
            { name: "label", type: "text", admin: { width: "50%" } },
            {
              name: "value",
              type: "text",
              required: true,
              admin: { width: "25%" },
            },
            { name: "suffix", type: "text", admin: { width: "25%" } },
          ],
        },
        { name: "description", type: "text" },
      ],
    },
  ],
};
