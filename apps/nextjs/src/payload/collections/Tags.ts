import type { CollectionConfig } from "payload";

import { anyone, isStaff } from "../access";
import { slugField } from "../fields/slug";

/**
 * Flat tags for content + member interests/segmentation, optionally grouped
 * into facets via `tag-groups` (e.g. Topic / Format / Region). Distinct from
 * the Supabase `public.tags` plan-name tags managed by the Stripe webhook.
 */
export const Tags: CollectionConfig = {
  slug: "tags",
  admin: {
    useAsTitle: "title",
    group: "Content",
    defaultColumns: ["title", "slug", "group"],
    // Managed inline from the Tag Groups page (the `tags` join below), so the
    // flat list is hidden from the nav to keep one entry point. Ungrouped tags
    // stay reachable via relationship pickers and the REST/Local API; create a
    // catch-all group (e.g. "General") if you want them editable in the UI.
    hidden: true,
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
    {
      name: "group",
      type: "relationship",
      relationTo: "tag-groups",
      admin: { description: "Optional filter facet this tag belongs to." },
    },
    { name: "description", type: "textarea" },
  ],
};

export const TagGroups: CollectionConfig = {
  slug: "tag-groups",
  admin: {
    useAsTitle: "title",
    group: "Content",
    defaultColumns: ["title", "slug", "displayOrder"],
  },
  defaultPopulate: { title: true, slug: true },
  access: {
    read: anyone,
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      admin: { description: 'e.g. "Topic", "Format", "Region".' },
    },
    slugField(),
    { name: "description", type: "textarea" },
    { name: "displayOrder", type: "number", admin: { position: "sidebar" } },
    // Tags in this group, managed inline (the Tags collection is hidden from
    // the nav — this join is the single entry point). Inverse of `Tags.group`.
    {
      name: "tags",
      type: "join",
      collection: "tags",
      on: "group",
      admin: {
        defaultColumns: ["title", "slug"],
        description: "Tags that belong to this group.",
      },
    },
  ],
};
