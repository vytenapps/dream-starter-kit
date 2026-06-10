import type { CollectionConfig } from "payload";

import { isStaff, publishedOrStaff } from "../access";
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
    read: publishedOrStaff,
    create: isStaff,
    update: isStaff,
    delete: isStaff,
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
