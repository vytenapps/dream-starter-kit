import type { Block } from "payload";

import { buttonsField } from "./shared";

/** Launch UI CTA — a centered closing call-to-action with a brand glow. */
export const CTABlock: Block = {
  slug: "cta",
  interfaceName: "CTABlock",
  labels: { singular: "Call to action", plural: "Calls to action" },
  fields: [{ name: "title", type: "text", required: true }, buttonsField()],
};
