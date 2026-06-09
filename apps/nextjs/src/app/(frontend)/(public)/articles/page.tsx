import type { Metadata } from "next";

import {
  ContentCard,
  ContentEmpty,
  ContentGrid,
} from "~/components/content/content-card";
import { PageHeader } from "~/components/content/page-header";
import { Section } from "~/components/launch-ui/ui/section";
import { listArticles } from "~/lib/payload";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Articles",
  description: "Latest articles.",
};

export default async function ArticlesPage() {
  const articles = await listArticles();

  return (
    <>
      <PageHeader title="Articles" description="Long-form posts and updates." />
      <Section className="pt-8 sm:pt-12 md:pt-16">
        {articles.length > 0 ? (
          <ContentGrid>
            {articles.map((article) => {
              const image =
                typeof article.heroImage === "object" && article.heroImage?.url
                  ? { url: article.heroImage.url, alt: article.heroImage.alt }
                  : null;
              return (
                <ContentCard
                  key={article.id}
                  href={`/articles/${article.slug}`}
                  title={article.title}
                  image={image}
                  meta={
                    article.publishedAt
                      ? new Date(article.publishedAt).toLocaleDateString()
                      : undefined
                  }
                  description={article.excerpt}
                />
              );
            })}
          </ContentGrid>
        ) : (
          <ContentEmpty>No articles yet.</ContentEmpty>
        )}
      </Section>
    </>
  );
}
