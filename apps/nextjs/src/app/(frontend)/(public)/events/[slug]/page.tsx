import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";

import { EventDetail } from "~/components/content/event-detail";
import { EventLivePreview } from "~/components/content/event-live-preview";
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

  // In draft mode (Payload Live Preview) hand off to the client wrapper so edits
  // stream into the admin iframe live; otherwise render server-side.
  const { isEnabled } = await draftMode();
  if (isEnabled) return <EventLivePreview initialData={event} />;
  return <EventDetail event={event} />;
}
