import type { CollectionConfig } from "payload";

import { isStaff, publishedOrStaff } from "../access";
import { accessLevelField } from "../fields/access-level";
import { commentsEnabledField } from "../fields/comments-enabled";
import { slugField } from "../fields/slug";

/** Rough reading time (minutes) from the Lexical body's text content. */
function estimateReadingTime(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  let words = 0;
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { text?: unknown; children?: unknown[] };
    if (typeof n.text === "string") {
      words += n.text.split(/\s+/).filter(Boolean).length;
    }
    if (Array.isArray(n.children)) n.children.forEach(walk);
  };
  walk((body as { root?: unknown }).root);
  return words > 0 ? Math.max(1, Math.ceil(words / 200)) : null;
}

/** Editorial long-form posts (the kit's blog). Drafts + scheduled publish. */
export const Posts: CollectionConfig = {
  slug: "posts",
  trash: true,
  folders: true,
  admin: {
    useAsTitle: "title",
    group: "Content",
    defaultColumns: ["title", "authorName", "publishedAt", "_status"],
    listSearchableFields: ["title", "excerpt"],
  },
  versions: { drafts: { schedulePublish: true }, maxPerDoc: 25 },
  access: {
    read: publishedOrStaff,
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  fields: [
    { name: "title", type: "text", required: true },
    slugField(),
    {
      name: "excerpt",
      type: "textarea",
      admin: { description: "Feed/preview text." },
    },
    { name: "body", type: "richText" },
    {
      name: "featuredImage",
      type: "upload",
      relationTo: "media",
      admin: { description: "Landscape hero image." },
    },
    {
      name: "cardImage",
      type: "upload",
      relationTo: "media",
      admin: { description: "Portrait card for the mobile feed (optional)." },
    },
    {
      name: "gallery",
      type: "upload",
      relationTo: "media",
      hasMany: true,
      admin: { description: "Inline images." },
    },
    {
      name: "author",
      type: "relationship",
      relationTo: "users",
      filterOptions: { roles: { in: ["author", "editor", "admin"] } },
    },
    {
      name: "coAuthors",
      type: "relationship",
      relationTo: "users",
      hasMany: true,
      filterOptions: { roles: { in: ["author", "editor", "admin"] } },
    },
    {
      name: "categories",
      type: "relationship",
      relationTo: "categories",
      hasMany: true,
    },
    { name: "tags", type: "relationship", relationTo: "tags", hasMany: true },
    {
      name: "relatedPosts",
      type: "relationship",
      relationTo: "posts",
      hasMany: true,
      admin: { description: "“Read next” suggestions." },
    },
    {
      name: "readingTime",
      type: "number",
      virtual: true,
      admin: { readOnly: true, description: "Computed minutes (not stored)." },
      hooks: {
        afterRead: [({ siblingData }) => estimateReadingTime(siblingData.body)],
      },
    },
    {
      // Flattens the author into list views/API responses without a populate.
      name: "authorName",
      type: "text",
      virtual: "author.displayName",
    },
    accessLevelField(),
    {
      name: "featured",
      type: "checkbox",
      defaultValue: false,
      admin: { position: "sidebar", description: "Pin to home/feed." },
    },
    commentsEnabledField(),
    {
      name: "publishedAt",
      type: "date",
      index: true,
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "comments",
      type: "join",
      collection: "comments",
      on: "target",
    },
  ],
};
