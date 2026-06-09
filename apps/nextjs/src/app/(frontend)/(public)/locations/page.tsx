import type { Metadata } from "next";

import {
  ContentCard,
  ContentEmpty,
  ContentGrid,
} from "~/components/content/content-card";
import { PageHeader } from "~/components/content/page-header";
import { Section } from "~/components/launch-ui/ui/section";
import { listLocations } from "~/lib/payload";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Locations",
  description: "Places to find us.",
};

export default async function LocationsPage() {
  const locations = await listLocations();

  return (
    <>
      <PageHeader title="Locations" description="Places to find us." />
      <Section className="pt-8 sm:pt-12 md:pt-16">
        {locations.length > 0 ? (
          <ContentGrid>
            {locations.map((location) => {
              const image =
                typeof location.image === "object" && location.image?.url
                  ? { url: location.image.url, alt: location.image.alt }
                  : null;
              return (
                <ContentCard
                  key={location.id}
                  href={`/locations/${location.slug}`}
                  title={location.name}
                  image={image}
                  description={location.address}
                />
              );
            })}
          </ContentGrid>
        ) : (
          <ContentEmpty>No locations yet.</ContentEmpty>
        )}
      </Section>
    </>
  );
}
