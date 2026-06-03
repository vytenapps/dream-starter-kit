import type { CollectionConfig } from "payload";

import { isAdmin, publishedOrAdmin } from "../access";
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
    read: publishedOrAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
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
