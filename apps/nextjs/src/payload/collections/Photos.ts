import type { CollectionConfig } from "payload";

import { anyone, isStaff } from "../access";
import { accessLevelField } from "../fields/access-level";
import { commentsEnabledField } from "../fields/comments-enabled";
import { slugField } from "../fields/slug";

/**
 * The app's *Photos* content section — an UPLOAD collection: the row IS the
 * image binary (offloaded to object storage by the S3 adapter), distinct from
 * the general `media` store. No drafts — the app filters by `publishedAt` /
 * `accessLevel`. Group into albums via `series` (kind: album).
 */
export const Photos: CollectionConfig = {
  slug: "photos",
  trash: true,
  folders: true,
  upload: {
    mimeTypes: ["image/*"],
    imageSizes: [
      { name: "thumbnail", width: 400 },
      { name: "card", width: 768 },
      { name: "hero", width: 1600 },
    ],
    focalPoint: true,
  },
  admin: {
    useAsTitle: "title",
    group: "Content",
    defaultColumns: ["title", "album", "publishedAt"],
    listSearchableFields: ["title", "caption"],
  },
  access: {
    read: anyone,
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  fields: [
    { name: "title", type: "text", required: true },
    slugField(),
    { name: "caption", type: "textarea" },
    {
      name: "altText",
      type: "text",
      admin: { description: "Accessibility description." },
    },
    {
      name: "credit",
      type: "text",
      admin: { description: "Photographer / source." },
    },
    { name: "takenAt", type: "date" },
    { name: "location", type: "relationship", relationTo: "locations" },
    {
      name: "album",
      type: "relationship",
      relationTo: "series",
      filterOptions: { kind: { equals: "album" } },
    },
    {
      name: "categories",
      type: "relationship",
      relationTo: "categories",
      hasMany: true,
    },
    { name: "tags", type: "relationship", relationTo: "tags", hasMany: true },
    accessLevelField(),
    {
      name: "featured",
      type: "checkbox",
      defaultValue: false,
      admin: { position: "sidebar" },
    },
    commentsEnabledField(),
    {
      name: "publishedAt",
      type: "date",
      index: true,
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
  ],
};
