import type { CollectionConfig } from "payload";

import { anyone, isStaff } from "../access";
import { slugField } from "../fields/slug";

/**
 * Editorial taxonomy for content (posts, videos, audio, photos, locations,
 * events, series). Hierarchical via the Nested Docs plugin, which manages the
 * `parent` relationship and auto-maintains `breadcrumbs`.
 */
export const Categories: CollectionConfig = {
  slug: "categories",
  trash: true,
  admin: {
    useAsTitle: "title",
    group: "Content",
    defaultColumns: ["title", "slug", "featured", "displayOrder"],
  },
  defaultPopulate: { title: true, slug: true },
  access: {
    read: anyone,
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  fields: [
    { name: "title", type: "text", required: true },
    slugField(),
    { name: "description", type: "textarea" },
    {
      name: "icon",
      type: "text",
      admin: { description: "Icon name for app navigation." },
    },
    {
      name: "color",
      type: "text",
      admin: { description: "Hex label/theme color, e.g. #7c3aed." },
    },
    { name: "image", type: "upload", relationTo: "media" },
    {
      name: "featured",
      type: "checkbox",
      defaultValue: false,
      admin: { position: "sidebar" },
    },
    {
      name: "displayOrder",
      type: "number",
      admin: { position: "sidebar" },
    },
  ],
};
