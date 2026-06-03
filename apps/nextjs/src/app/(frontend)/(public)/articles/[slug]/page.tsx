import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CmsRichText } from "~/components/rich-text";
import { getArticle } from "~/lib/payload";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug).catch(() => null);
  return {
    title: article?.meta?.title ?? article?.title ?? "Article",
    description: article?.meta?.description ?? article?.excerpt ?? undefined,
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const heroImage =
    typeof article.heroImage === "object" && article.heroImage
      ? article.heroImage
      : null;

  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      {heroImage?.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={heroImage.url}
          alt={heroImage.alt}
          className="mb-8 w-full rounded-xl object-cover"
        />
      )}
      <h1 className="text-3xl font-bold tracking-tight">{article.title}</h1>
      {article.publishedAt && (
        <p className="text-muted-foreground mt-2 text-sm">
          {new Date(article.publishedAt).toLocaleDateString()}
        </p>
      )}
      <div className="mt-6">
        <CmsRichText data={article.body} />
      </div>
    </main>
  );
}
