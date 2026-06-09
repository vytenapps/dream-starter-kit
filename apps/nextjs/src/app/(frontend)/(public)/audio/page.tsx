import type { Metadata } from "next";

import {
  ContentCard,
  ContentEmpty,
  ContentGrid,
} from "~/components/content/content-card";
import { PageHeader } from "~/components/content/page-header";
import { Section } from "~/components/launch-ui/ui/section";
import { listAudio } from "~/lib/payload";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Audio",
  description: "Audio library.",
};

export default async function AudioPage() {
  const audio = await listAudio();

  return (
    <>
      <PageHeader title="Audio" description="Listen on the go." />
      <Section className="pt-8 sm:pt-12 md:pt-16">
        {audio.length > 0 ? (
          <ContentGrid>
            {audio.map((track) => (
              <ContentCard
                key={track.id}
                title={track.title}
                description={track.description}
              />
            ))}
          </ContentGrid>
        ) : (
          <ContentEmpty>No audio yet.</ContentEmpty>
        )}
      </Section>
    </>
  );
}
