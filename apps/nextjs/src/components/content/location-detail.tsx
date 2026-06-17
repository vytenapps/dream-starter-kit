import type { Location as LocationDoc } from "@acme/cms";

import { DetailLayout } from "~/components/content/detail-layout";
import { CmsRichText } from "~/components/rich-text";
import { formatAddress } from "~/lib/format-address";

/**
 * Presentational render of a `locations` document. Shared by the server route
 * (published path) and the client `LocationLivePreview` wrapper (draft path).
 */
export function LocationDetail({ location }: { location: LocationDoc }) {
  const image =
    typeof location.featuredImage === "object" && location.featuredImage?.url
      ? { url: location.featuredImage.url, alt: location.featuredImage.alt }
      : null;
  const address = formatAddress(location.address);
  // Payload `point` stores [lng, lat].
  const coords = location.coordinates;

  return (
    <DetailLayout
      title={location.name}
      image={image}
      meta={
        <dl className="space-y-1">
          {address && <div>{address}</div>}
          {coords && (
            <div>
              {coords[1]}, {coords[0]}
            </div>
          )}
        </dl>
      }
    >
      <CmsRichText data={location.description} />
    </DetailLayout>
  );
}
