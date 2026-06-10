import type { CollectionConfig } from "payload";

import { isStaff, publishedOrStaff } from "../access";
import { slugField } from "../fields/slug";

export const Locations: CollectionConfig = {
  slug: "locations",
  admin: {
    useAsTitle: "name",
    group: "Content",
    defaultColumns: ["name", "_status"],
  },
  versions: { drafts: true },
  access: {
    read: publishedOrStaff,
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  fields: [
    { name: "name", type: "text", required: true },
    slugField("name"),
    { name: "address", type: "textarea" },
    { name: "latitude", type: "number" },
    { name: "longitude", type: "number" },
    { name: "description", type: "richText" },
    { name: "image", type: "upload", relationTo: "media" },
  ],
};
