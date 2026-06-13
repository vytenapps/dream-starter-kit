import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardDescription, CardHeader, CardTitle } from "@acme/ui/card";

import { getDocsNav } from "./data";
import { DocsShell } from "./docs-shell";

export const metadata: Metadata = {
  title: "Docs",
  description: "Developer documentation.",
};

/** /docs index — overview cards linking into each category's pages. */
export async function DocsIndexPage() {
  const nav = await getDocsNav();

  return (
    <DocsShell nav={nav} showToc={false}>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">
          Documentation
        </h1>
        <p className="text-muted-foreground mb-8">
          Browse the guides below, search with{" "}
          <kbd className="bg-muted rounded border px-1.5 py-0.5 text-xs">
            ⌘K
          </kbd>
          , or ask the AI assistant.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {nav.flatMap((group) =>
            group.items.map((item) => (
              <Link href={`/docs/${item.slug}`} key={item.slug}>
                <Card className="hover:border-foreground/30 h-full transition-colors">
                  <CardHeader>
                    <CardDescription>{group.category}</CardDescription>
                    <CardTitle className="text-base">{item.title}</CardTitle>
                  </CardHeader>
                </Card>
              </Link>
            )),
          )}
        </div>
      </div>
    </DocsShell>
  );
}
