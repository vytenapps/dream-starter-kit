import type { Metadata } from "next";
import { notFound } from "next/navigation";

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

  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">{event.title}</h1>
      <dl className="text-muted-foreground mt-2 space-y-1 text-sm">
        <div>Starts: {new Date(event.startsAt).toLocaleString()}</div>
        {event.endsAt && (
          <div>Ends: {new Date(event.endsAt).toLocaleString()}</div>
        )}
        {location && <div>Location: {location.name}</div>}
      </dl>
      <div className="mt-6">
        <CmsRichText data={event.description} />
      </div>
    </main>
  );
}
