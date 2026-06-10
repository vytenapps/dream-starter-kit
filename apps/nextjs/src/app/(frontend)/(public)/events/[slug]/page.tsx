import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DetailLayout } from "~/components/content/detail-layout";
import { CmsRichText } from "~/components/rich-text";
import { getEvent } from "~/lib/payload";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug).catch(() => null);
  return { title: event?.title ?? "Event" };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

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
