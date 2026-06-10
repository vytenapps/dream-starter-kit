import type { CollectionConfig } from "payload";

import { isStaff, publishedOrStaff } from "../access";
import { slugField } from "../fields/slug";

export const Posts: CollectionConfig = {
  slug: "posts",
  admin: {
    useAsTitle: "title",
    group: "Content",
    defaultColumns: ["title", "publishedAt", "_status"],
  },
  versions: { drafts: true },
  access: {
    read: publishedOrStaff,
    create: isStaff,
    update: isStaff,
    delete: isStaff,
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
