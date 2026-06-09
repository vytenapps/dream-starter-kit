import type { Block } from "payload";

/**
 * Rich-text prose section — for text-heavy pages (about, terms, privacy) that
 * don't map onto a marketing section. Renders a centered article column.
 */
export const ProseBlock: Block = {
  slug: "prose",
  interfaceName: "ProseBlock",
  labels: { singular: "Prose", plural: "Prose" },
  fields: [
    { name: "title", type: "text" },
    { name: "content", type: "richText", required: true },
  ],
};
