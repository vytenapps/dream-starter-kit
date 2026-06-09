import { draftMode } from "next/headers";

import type { Page } from "@acme/cms";

import { LivePreview } from "~/components/live-preview";
import { RenderBlocks } from "~/components/render-blocks";

/**
 * Renders a Payload `pages` document via its Launch UI block `layout`. In draft
 * mode (Payload Live Preview) it hands off to the client `LivePreview` wrapper
 * so edits stream into the admin iframe live; otherwise it renders the blocks
 * server-side.
 */
export async function PageView({ page }: { page: Page }) {
  const { isEnabled } = await draftMode();
  if (isEnabled) return <LivePreview initialData={page} />;
  return <RenderBlocks blocks={page.layout} />;
}
