import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { listVideos } from "~/lib/payload";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Videos",
  description: "Video library.",
};

export default async function VideosPage() {
  const videos = await listVideos();

  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Videos</h1>

      {videos.length > 0 ? (
        <ul className="mt-8 grid gap-4">
          {videos.map((video) => {
            const card = (
              <Card className="hover:border-foreground/20 transition-colors">
                <CardHeader>
                  <CardTitle className="text-xl">{video.title}</CardTitle>
                  {video.description && (
                    <CardDescription>{video.description}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            );
            return (
              <li key={video.id}>
                {video.sourceType === "url" && video.url ? (
                  <Link
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {card}
                  </Link>
                ) : (
                  card
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground mt-8">No videos yet.</p>
      )}
    </main>
  );
}
