import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CmsRichText } from "~/components/rich-text";
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
    description: location?.address ?? undefined,
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

  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">{location.name}</h1>
      <dl className="text-muted-foreground mt-2 space-y-1 text-sm">
        {location.address && <div>{location.address}</div>}
        {location.latitude != null && location.longitude != null && (
          <div>
            {location.latitude}, {location.longitude}
          </div>
        )}
      </dl>
      <div className="mt-6">
        <CmsRichText data={location.description} />
      </div>
    </main>
  );
}
