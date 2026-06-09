import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DetailLayout } from "~/components/content/detail-layout";
import { CmsRichText } from "~/components/rich-text";
import { getLocation } from "~/lib/payload";

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
    description: location?.address ?? undefined,
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
    typeof location.image === "object" && location.image?.url
      ? { url: location.image.url, alt: location.image.alt }
      : null;

  return (
    <DetailLayout
      title={location.name}
      image={image}
      meta={
        <dl className="space-y-1">
          {location.address && <div>{location.address}</div>}
          {location.latitude != null && location.longitude != null && (
            <div>
              {location.latitude}, {location.longitude}
            </div>
          )}
        </dl>
      }
    >
      <CmsRichText data={location.description} />
    </DetailLayout>
  );
}
