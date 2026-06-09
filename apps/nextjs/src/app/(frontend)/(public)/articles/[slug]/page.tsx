import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DetailLayout } from "~/components/content/detail-layout";
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

  const image =
    typeof article.heroImage === "object" && article.heroImage?.url
      ? { url: article.heroImage.url, alt: article.heroImage.alt }
      : null;

  return (
    <DetailLayout
      title={article.title}
      image={image}
      meta={
        article.publishedAt
          ? new Date(article.publishedAt).toLocaleDateString()
          : undefined
      }
    >
      <CmsRichText data={article.body} />
    </DetailLayout>
  );
}
