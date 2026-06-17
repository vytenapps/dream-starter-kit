import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";

import { LocationDetail } from "~/components/content/location-detail";
import { LocationLivePreview } from "~/components/content/location-live-preview";
import { formatAddress } from "~/lib/format-address";
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

  // In draft mode (Payload Live Preview) hand off to the client wrapper so edits
  // stream into the admin iframe live; otherwise render server-side.
  const { isEnabled } = await draftMode();
  if (isEnabled) return <LocationLivePreview initialData={location} />;
  return <LocationDetail location={location} />;
}
