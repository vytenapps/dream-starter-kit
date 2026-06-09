import type { Metadata } from "next";

import {
  ContentCard,
  ContentEmpty,
  ContentGrid,
} from "~/components/content/content-card";
import { PageHeader } from "~/components/content/page-header";
import { Section } from "~/components/launch-ui/ui/section";
import { listVideos } from "~/lib/payload";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Videos",
  description: "Video library.",
};

export default async function VideosPage() {
  const videos = await listVideos();

  return (
    <>
      <PageHeader title="Videos" description="Watch and learn." />
      <Section className="pt-8 sm:pt-12 md:pt-16">
        {videos.length > 0 ? (
          <ContentGrid>
            {videos.map((video) => {
              const thumb =
                typeof video.thumbnail === "object" && video.thumbnail?.url
                  ? { url: video.thumbnail.url, alt: video.thumbnail.alt }
                  : null;
              const href =
                video.sourceType === "url" && video.url ? video.url : undefined;
              return (
                <ContentCard
                  key={video.id}
                  href={href}
                  external={Boolean(href)}
                  title={video.title}
                  image={thumb}
                  description={video.description}
                />
              );
            })}
          </ContentGrid>
        ) : (
          <ContentEmpty>No videos yet.</ContentEmpty>
        )}
      </Section>
    </>
  );
}
