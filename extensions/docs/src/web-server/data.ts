import "server-only";

import config from "@payload-config";
import { getPayload } from "payload";

import type { ExtDocsPage } from "@acme/cms";

export interface DocNavItem {
  title: string;
  slug: string;
  order: number;
}
export interface DocNavGroup {
  category: string;
  items: DocNavItem[];
}

/** Published docs grouped by category, ordered — drives the sidebar + prev/next. */
export async function getDocsNav(): Promise<DocNavGroup[]> {
  const payload = await getPayload({ config });
  const res = await payload.find({
    collection: "ext-docs-pages",
    where: { _status: { equals: "published" } },
    limit: 500,
    depth: 0,
    sort: "order",
  });
  const docs = res.docs;

  const groups = new Map<string, DocNavItem[]>();
  for (const d of docs) {
    const trimmed = d.category?.trim();
    const category = trimmed && trimmed.length > 0 ? trimmed : "Docs";
    const list = groups.get(category) ?? [];
    list.push({ title: d.title, slug: d.slug, order: d.order ?? 0 });
    groups.set(category, list);
  }
  return [...groups.entries()].map(([category, items]) => ({
    category,
    items: items.sort((a, b) => a.order - b.order),
  }));
}

export async function getDocPage(slug: string): Promise<ExtDocsPage | null> {
  const payload = await getPayload({ config });
  const res = await payload.find({
    collection: "ext-docs-pages",
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
  });
  return (res.docs[0] as ExtDocsPage | undefined) ?? null;
}

/** Flat ordered list of {title, slug} for prev/next navigation. */
export function flattenNav(groups: DocNavGroup[]): DocNavItem[] {
  return groups.flatMap((g) => g.items);
}
