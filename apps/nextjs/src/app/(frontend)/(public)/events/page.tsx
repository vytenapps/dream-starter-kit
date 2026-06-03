import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardHeader, CardTitle } from "~/components/ui/card";
import { listEvents } from "~/lib/payload";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events",
  description: "Upcoming events.",
};

export default async function EventsPage() {
  const events = await listEvents();

  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Events</h1>

      {events.length > 0 ? (
        <ul className="mt-8 grid gap-4">
          {events.map((event) => (
            <li key={event.id}>
              <Link href={`/events/${event.slug}`}>
                <Card className="hover:border-foreground/20 transition-colors">
                  <CardHeader>
                    <CardTitle className="text-xl">{event.title}</CardTitle>
                    <p className="text-muted-foreground text-sm">
                      {new Date(event.startsAt).toLocaleString()}
                    </p>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground mt-8">No events scheduled.</p>
      )}
    </main>
  );
}
