import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DetailLayout } from "~/components/content/detail-layout";
import { CmsRichText } from "~/components/rich-text";
import { formatAddress, getLocation } from "~/lib/payload";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const location = await getLocation(slug).catch(() => null);
  return {
    title: location?.name ?? "Location",
    description:
      location?.shortDescription ??
      formatAddress(location?.address) ??
      undefined,
  };
}

export default async function LocationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const location = await getLocation(slug);
  if (!location) notFound();

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
