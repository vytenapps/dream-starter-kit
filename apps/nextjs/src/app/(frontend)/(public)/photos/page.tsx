import type { Metadata } from "next";

import { ContentEmpty } from "~/components/content/content-card";
import { PageHeader } from "~/components/content/page-header";
import { Section } from "~/components/launch-ui/ui/section";
import { listPhotos } from "~/lib/payload";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Photos",
  description: "Photo gallery.",
};

export default async function PhotosPage() {
  const photos = await listPhotos();

  return (
    <>
      <PageHeader title="Photos" description="Galleries and imagery." />
      <Section className="pt-8 sm:pt-12 md:pt-16">
        <div className="max-w-container mx-auto">
          {photos.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((photo) => {
                const image =
                  typeof photo.image === "object" ? photo.image : null;
                return (
                  <figure key={photo.id} className="space-y-2">
                    {image?.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={image.url}
                        alt={image.alt}
                        className="aspect-square w-full rounded-lg object-cover"
                      />
                    )}
                    <figcaption className="text-sm">
                      <span className="font-medium">{photo.title}</span>
                      {photo.caption && (
                        <span className="text-muted-foreground block">
                          {photo.caption}
                        </span>
                      )}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          ) : (
            <ContentEmpty>No photos yet.</ContentEmpty>
          )}
        </div>
      </Section>
    </>
  );
}
