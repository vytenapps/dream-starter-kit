import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { listLocations } from "~/lib/payload";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Locations",
  description: "Places to find us.",
};

export default async function LocationsPage() {
  const locations = await listLocations();

  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Locations</h1>

      {locations.length > 0 ? (
        <ul className="mt-8 grid gap-4">
          {locations.map((location) => (
            <li key={location.id}>
              <Link href={`/locations/${location.slug}`}>
                <Card className="hover:border-foreground/20 transition-colors">
                  <CardHeader>
                    <CardTitle className="text-xl">{location.name}</CardTitle>
                    {location.address && (
                      <CardDescription>{location.address}</CardDescription>
                    )}
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground mt-8">No locations yet.</p>
      )}
    </main>
  );
}
