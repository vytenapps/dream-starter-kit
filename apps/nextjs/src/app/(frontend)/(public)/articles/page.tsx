import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { listArticles } from "~/lib/payload";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Articles",
  description: "Latest articles.",
};

export default async function ArticlesPage() {
  const articles = await listArticles();

  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Articles</h1>

      {articles.length > 0 ? (
        <ul className="mt-8 grid gap-4">
          {articles.map((article) => (
            <li key={article.id}>
              <Link href={`/articles/${article.slug}`}>
                <Card className="hover:border-foreground/20 transition-colors">
                  <CardHeader>
                    <CardTitle className="text-xl">{article.title}</CardTitle>
                    {article.publishedAt && (
                      <p className="text-muted-foreground text-sm">
                        {new Date(article.publishedAt).toLocaleDateString()}
                      </p>
                    )}
                    {article.excerpt && (
                      <CardDescription>{article.excerpt}</CardDescription>
                    )}
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground mt-8">No articles yet.</p>
      )}
    </main>
  );
}
