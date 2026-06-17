"use client";

import { useLivePreview } from "@payloadcms/live-preview-react";

import type { Location as LocationDoc } from "@acme/cms";

import { LocationDetail } from "~/components/content/location-detail";
import { env } from "~/env";

/**
 * Client wrapper used only inside the Payload admin's Live Preview iframe (when
 * Next.js draft mode is on). It subscribes to the editor's live edits via
 * `useLivePreview` and re-renders the location in place — no save/refresh needed.
 */
export function LocationLivePreview({
  initialData,
}: {
  initialData: LocationDoc;
}) {
  const serverURL =
    env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const { data } = useLivePreview<LocationDoc>({
    initialData,
    serverURL,
    depth: 1,
  });
  return <LocationDetail location={data} />;
}
