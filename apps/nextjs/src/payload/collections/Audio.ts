import type { CollectionConfig } from "payload";

import { isStaff, publishedOrStaff } from "../access";
import { slugField } from "../fields/slug";

export const Audio: CollectionConfig = {
  slug: "audio",
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
    { name: "audioFile", type: "upload", relationTo: "media", required: true },
    {
      name: "duration",
      type: "number",
      admin: { description: "Length in seconds." },
    },
  ],
};
