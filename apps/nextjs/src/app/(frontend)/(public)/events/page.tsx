import type { Metadata } from "next";

import {
  ContentCard,
  ContentEmpty,
  ContentGrid,
} from "~/components/content/content-card";
import { PageHeader } from "~/components/content/page-header";
import { Section } from "~/components/launch-ui/ui/section";
import { listEvents } from "~/lib/payload";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events",
  description: "Upcoming events.",
};

export default async function EventsPage() {
  const events = await listEvents();

  return (
    <>
      <PageHeader title="Events" description="Upcoming and past events." />
      <Section className="pt-8 sm:pt-12 md:pt-16">
        {events.length > 0 ? (
          <ContentGrid>
            {events.map((event) => {
              const image =
                typeof event.image === "object" && event.image?.url
                  ? { url: event.image.url, alt: event.image.alt }
                  : null;
              return (
                <ContentCard
                  key={event.id}
                  href={`/events/${event.slug}`}
                  title={event.title}
                  image={image}
                  meta={new Date(event.startsAt).toLocaleString()}
                />
              );
            })}
          </ContentGrid>
        ) : (
          <ContentEmpty>No events scheduled.</ContentEmpty>
        )}
      </Section>
    </>
  );
}
