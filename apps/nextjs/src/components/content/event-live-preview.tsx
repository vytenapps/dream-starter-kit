"use client";

import { useLivePreview } from "@payloadcms/live-preview-react";

import type { Event as EventDoc } from "@acme/cms";

import { EventDetail } from "~/components/content/event-detail";
import { env } from "~/env";

/**
 * Client wrapper used only inside the Payload admin's Live Preview iframe (when
 * Next.js draft mode is on). It subscribes to the editor's live edits via
 * `useLivePreview` and re-renders the event in place — no save or refresh needed.
 */
export function EventLivePreview({ initialData }: { initialData: EventDoc }) {
  // Use the iframe's own origin (shared with the admin) — useLivePreview's
  // postMessage origin check is strict, and NEXT_PUBLIC_APP_URL defaults to
  // localhost:3000, which broke live updates on real deploys. See live-preview.tsx.
  const serverURL =
    typeof window !== "undefined"
      ? window.location.origin
      : env.NEXT_PUBLIC_APP_URL;
  const { data } = useLivePreview<EventDoc>({
    initialData,
    serverURL,
    depth: 1,
  });
  return <EventDetail event={data} />;
}
