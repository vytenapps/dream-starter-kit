import type { CollectionConfig } from "payload";

import { isStaff, publishedOrStaff } from "../access";
import { slugField } from "../fields/slug";

export const Videos: CollectionConfig = {
  slug: "videos",
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
    { name: "description", type: "textarea" },
    {
      name: "sourceType",
      type: "radio",
      required: true,
      defaultValue: "url",
      options: [
        { label: "External URL", value: "url" },
        { label: "Uploaded file", value: "upload" },
      ],
    },
    {
      name: "url",
      type: "text",
      admin: { condition: (data) => data.sourceType === "url" },
    },
    {
      name: "file",
      type: "upload",
      relationTo: "media",
      admin: { condition: (data) => data.sourceType === "upload" },
    },
    { name: "thumbnail", type: "upload", relationTo: "media" },
    {
      name: "duration",
      type: "number",
      admin: { description: "Length in seconds." },
    },
  ],
};
