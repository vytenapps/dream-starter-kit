"use client";

import { useLivePreview } from "@payloadcms/live-preview-react";

import type { Page } from "@acme/cms";

import { RenderBlocks } from "~/components/render-blocks";
import { env } from "~/env";

/**
 * Client wrapper used only inside the Payload admin's Live Preview iframe (when
 * Next.js draft mode is on). It subscribes to the editor's live edits via
 * `useLivePreview` and re-renders the page's block layout in place — no save or
 * refresh needed.
 */
export function LivePreview({ initialData }: { initialData: Page }) {
  const serverURL =
    env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const { data } = useLivePreview<Page>({ initialData, serverURL, depth: 2 });
  return <RenderBlocks blocks={data.layout} />;
}
