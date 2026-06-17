import type { Event as EventDoc } from "@acme/cms";

import { DetailLayout } from "~/components/content/detail-layout";
import { CmsRichText } from "~/components/rich-text";

/**
 * Presentational render of an `events` document. Shared by the server route
 * (published path) and the client `EventLivePreview` wrapper (draft path).
 */
export function EventDetail({ event }: { event: EventDoc }) {
  const location =
    typeof event.location === "object" && event.location
      ? event.location
      : null;
  const image =
    typeof event.featuredImage === "object" && event.featuredImage?.url
      ? { url: event.featuredImage.url, alt: event.featuredImage.alt }
      : null;

  return (
    <DetailLayout
      title={event.title}
      image={image}
      meta={
        <dl className="space-y-1">
          <div>Starts: {new Date(event.startsAt).toLocaleString()}</div>
          {event.endsAt && (
            <div>Ends: {new Date(event.endsAt).toLocaleString()}</div>
          )}
          {location && <div>Location: {location.name}</div>}
        </dl>
      }
    >
      <CmsRichText data={event.description} />
    </DetailLayout>
  );
}
