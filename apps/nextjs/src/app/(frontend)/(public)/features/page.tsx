import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageView } from "~/components/page-view";
import { getPage } from "~/lib/payload";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("features").catch(() => null);
  return {
    title: page?.meta?.title ?? page?.title ?? "Features",
    description: page?.meta?.description ?? undefined,
  };
}

export default async function FeaturesPage() {
  const page = await getPage("features");
  if (!page) notFound();
  return <PageView page={page} />;
}
