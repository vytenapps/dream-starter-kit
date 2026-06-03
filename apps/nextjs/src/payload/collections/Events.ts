import type { CollectionConfig } from "payload";

import { isAdmin, publishedOrAdmin } from "../access";
import { slugField } from "../fields/slug";

export const Events: CollectionConfig = {
  slug: "events",
  admin: {
    useAsTitle: "title",
    group: "Content",
    defaultColumns: ["title", "startsAt", "_status"],
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
    { name: "description", type: "richText" },
    {
      name: "startsAt",
      type: "date",
      required: true,
      admin: { date: { pickerAppearance: "dayAndTime" } },
    },
    {
      name: "endsAt",
      type: "date",
      admin: { date: { pickerAppearance: "dayAndTime" } },
    },
    { name: "location", type: "relationship", relationTo: "locations" },
    { name: "image", type: "upload", relationTo: "media" },
  ],
};
