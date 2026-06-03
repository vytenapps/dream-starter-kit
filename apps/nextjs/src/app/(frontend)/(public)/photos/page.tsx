import type { Metadata } from "next";

import { listPhotos } from "~/lib/payload";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Photos",
  description: "Photo gallery.",
};

export default async function PhotosPage() {
  const photos = await listPhotos();

  return (
    <main className="container mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Photos</h1>

      {photos.length > 0 ? (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {photos.map((photo) => {
            const image = typeof photo.image === "object" ? photo.image : null;
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
        <p className="text-muted-foreground mt-8">No photos yet.</p>
      )}
    </main>
  );
}
