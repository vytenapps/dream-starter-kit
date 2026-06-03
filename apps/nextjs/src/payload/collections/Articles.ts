import type { CollectionConfig } from "payload";

import { isAdmin, publishedOrAdmin } from "../access";
import { slugField } from "../fields/slug";

export const Articles: CollectionConfig = {
  slug: "articles",
  admin: {
    useAsTitle: "title",
    group: "Content",
    defaultColumns: ["title", "publishedAt", "_status"],
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
    { name: "excerpt", type: "textarea" },
    { name: "heroImage", type: "upload", relationTo: "media" },
    { name: "body", type: "richText" },
    { name: "author", type: "relationship", relationTo: "users" },
    { name: "tags", type: "text", hasMany: true },
    {
      name: "publishedAt",
      type: "date",
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
  ],
};
