import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RichText } from "@payloadcms/richtext-lexical/react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { CopyPageButton } from "../web/copy-page-button";
import { ExplainMore } from "../web/explain-more";
import { flattenNav, getDocPage, getDocsNav } from "./data";
import { DocsShell } from "./docs-shell";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getDocPage(slug).catch(() => null);
  return {
    title: page ? `${page.title} · Docs` : "Docs",
    description: page?.excerpt ?? undefined,
  };
}

export async function DocsDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [page, nav] = await Promise.all([getDocPage(slug), getDocsNav()]);
  if (!page) notFound();

  const flat = flattenNav(nav);
  const idx = flat.findIndex((d) => d.slug === slug);
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;

  return (
    <DocsShell activeSlug={slug} nav={nav}>
      <article className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            {page.category ? (
              <div className="text-muted-foreground mb-1 text-sm">
                {page.category}
              </div>
            ) : null}
            <h1 className="text-3xl font-bold tracking-tight">{page.title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <CopyPageButton />
            <ExplainMore pageTitle={page.title} slug={slug} />
          </div>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none">
          {page.body ? (
            <RichText
              data={page.body as React.ComponentProps<typeof RichText>["data"]}
            />
          ) : null}
        </div>

        <nav className="mt-12 flex items-center justify-between border-t pt-6 text-sm">
          {prev ? (
            <Link
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              href={`/docs/${prev.slug}`}
            >
              <ChevronLeftIcon className="size-4" />
              {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              href={`/docs/${next.slug}`}
            >
              {next.title}
              <ChevronRightIcon className="size-4" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </article>
    </DocsShell>
  );
}
