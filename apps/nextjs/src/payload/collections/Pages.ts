import type { CollectionConfig } from "payload";

import { isAdmin, publishedOrAdmin } from "../access";
import { slugField } from "../fields/slug";

/**
 * Static marketing/legal pages, addressed by slug (home, about, contact, terms,
 * privacy). One collection (vs. five globals) keeps editing uniform: one "Pages"
 * list, shared SEO/draft handling, and a single `[slug]` public route. Add a new
 * static page = add a row, no code.
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
    { name: "body", type: "richText" },
  ],
};
