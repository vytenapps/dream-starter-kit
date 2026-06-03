import type { Metadata } from "next";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { listAudio } from "~/lib/payload";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Audio",
  description: "Audio library.",
};

export default async function AudioPage() {
  const audio = await listAudio();

  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Audio</h1>

      {audio.length > 0 ? (
        <ul className="mt-8 grid gap-4">
          {audio.map((track) => (
            <li key={track.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">{track.title}</CardTitle>
                  {track.description && (
                    <CardDescription>{track.description}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground mt-8">No audio yet.</p>
      )}
    </main>
  );
}
