import type { Page } from "@acme/cms";

import { RenderBlocks } from "~/components/render-blocks";

/** Renders a Payload `pages` document via its Launch UI block `layout`. */
export function PageView({ page }: { page: Page }) {
  return <RenderBlocks blocks={page.layout} />;
}
