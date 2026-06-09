import type { CollectionConfig } from "payload";

import { isAdmin, publishedOrAdmin } from "../access";
import { pageBlocks } from "../blocks";
import { slugField } from "../fields/slug";

/**
 * Marketing/legal pages, addressed by slug (home, about, contact, terms,
 * privacy). One collection (vs. five globals) keeps editing uniform: one "Pages"
 * list, shared SEO/draft handling, and a single `[slug]` public route. Add a new
 * page = add a row, no code.
 *
 * Each page is composed from a `layout` of Launch UI blocks (hero, features,
 * logos, stats, CTA, FAQ, prose) — see `../blocks` and the `RenderBlocks`
 * component that maps them to React sections.
 */
export const Pages: CollectionConfig = {
  slug: "pages",
  admin: {
    useAsTitle: "title",
    group: "Content",
    defaultColumns: ["title", "slug", "_status"],
  },
  versions: { drafts: true },
  access: {
    read: publishedOrAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: "title", type: "text", required: true },
    slugField(),
    {
      name: "layout",
      type: "blocks",
      labels: { singular: "Section", plural: "Sections" },
      blocks: pageBlocks,
    },
  ],
};
