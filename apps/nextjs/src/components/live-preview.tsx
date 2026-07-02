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
  // The preview iframe always shares the admin's origin, so use it directly —
  // useLivePreview's postMessage `event.origin === serverURL` check is strict.
  // NEXT_PUBLIC_APP_URL defaults to localhost:3000 (always truthy), so preferring
  // it broke live updates on any deploy whose real host differs. Env is only the
  // SSR fallback (useLivePreview runs client-side).
  const serverURL =
    typeof window !== "undefined"
      ? window.location.origin
      : env.NEXT_PUBLIC_APP_URL;
  const { data } = useLivePreview<Page>({ initialData, serverURL, depth: 2 });
  return <RenderBlocks blocks={data.layout} />;
}
