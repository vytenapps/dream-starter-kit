import type { CollectionConfig } from "payload";

import { isAdmin, publishedOrAdmin } from "../access";
import { slugField } from "../fields/slug";

export const Photos: CollectionConfig = {
  slug: "photos",
  admin: {
    useAsTitle: "title",
    group: "Content",
    defaultColumns: ["title", "_status"],
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
    { name: "image", type: "upload", relationTo: "media", required: true },
    { name: "caption", type: "text" },
    {
      name: "gallery",
      type: "array",
      label: "Gallery",
      fields: [
        { name: "image", type: "upload", relationTo: "media", required: true },
        { name: "caption", type: "text" },
      ],
    },
  ],
};
