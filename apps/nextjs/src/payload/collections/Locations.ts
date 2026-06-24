import type { CollectionConfig } from "payload";

import { generatePreviewPath, previewBreakpoints } from "../../lib/preview";
import { isStaff, publishedOrStaff } from "../access";
import { commentsEnabledField } from "../fields/comments-enabled";
import { generatedImageFields } from "../fields/generated-images";
import { slugField } from "../fields/slug";
import { generateImagesHook, syncImageUrls } from "../hooks/generate-images";
import { locationImages } from "../image-collections";

const DAYS = [
  { label: "Monday", value: "monday" },
  { label: "Tuesday", value: "tuesday" },
  { label: "Wednesday", value: "wednesday" },
  { label: "Thursday", value: "thursday" },
  { label: "Friday", value: "friday" },
  { label: "Saturday", value: "saturday" },
  { label: "Sunday", value: "sunday" },
];

/** Places — stores, venues, offices. Drafts; reviews/events join back here. */
export const Locations: CollectionConfig = {
  slug: "locations",
  trash: true,
  folders: true,
  admin: {
    useAsTitle: "name",
    group: "Content",
    defaultColumns: ["name", "locationType", "_status"],
    listSearchableFields: ["name", "shortDescription"],
    // Live Preview: the admin iframe loads /next/preview, which enables draft
    // mode and renders the location's draft (see lib/preview + /next/preview).
    livePreview: {
      url: ({ data }) =>
        generatePreviewPath({
          collection: "locations",
          slug: typeof data.slug === "string" ? data.slug : undefined,
        }),
      breakpoints: previewBreakpoints,
    },
    preview: (doc) =>
      generatePreviewPath({
        collection: "locations",
        slug: typeof doc.slug === "string" ? doc.slug : undefined,
      }),
  },
  versions: { drafts: { schedulePublish: true }, maxPerDoc: 25 },
  access: {
    read: publishedOrStaff,
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  hooks: {
    beforeChange: [
      generateImagesHook(locationImages),
      syncImageUrls(locationImages),
    ],
  },
  fields: [
    { name: "name", type: "text", required: true },
    slugField("name"),
    {
      name: "shortDescription",
      type: "textarea",
      admin: { description: "Map-pin/card text." },
    },
    { name: "description", type: "richText" },
    {
      name: "address",
      type: "group",
      fields: [
        { name: "street", type: "text" },
        { name: "street2", type: "text" },
        {
          type: "row",
          fields: [
            { name: "city", type: "text" },
            { name: "region", type: "text" },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "postalCode", type: "text" },
            { name: "country", type: "text" },
          ],
        },
      ],
    },
    {
      name: "coordinates",
      type: "point",
      label: "Coordinates (lng, lat)",
    },
    {
      name: "hours",
      type: "array",
      fields: [
        { name: "day", type: "select", options: DAYS, required: true },
        { name: "opensAt", type: "text" },
        { name: "closesAt", type: "text" },
        { name: "closed", type: "checkbox", defaultValue: false },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "phone", type: "text" },
        { name: "email", type: "email" },
        { name: "website", type: "text" },
      ],
    },
    {
      name: "priceRange",
      type: "select",
      options: ["$", "$$", "$$$", "$$$$"],
    },
    {
      name: "amenities",
      type: "select",
      hasMany: true,
      options: [
        { label: "Wi-Fi", value: "wifi" },
        { label: "Parking", value: "parking" },
        { label: "Wheelchair accessible", value: "accessible" },
        { label: "Pet friendly", value: "pets" },
        { label: "Outdoor seating", value: "outdoor_seating" },
        { label: "Restrooms", value: "restrooms" },
        { label: "Food", value: "food" },
        { label: "Drinks", value: "drinks" },
      ],
    },
    { name: "featuredImage", type: "upload", relationTo: "media" },
    {
      name: "gallery",
      type: "upload",
      relationTo: "media",
      hasMany: true,
    },
    {
      name: "locationType",
      type: "relationship",
      relationTo: "categories",
    },
    { name: "tags", type: "relationship", relationTo: "tags", hasMany: true },
    {
      name: "ratingAverage",
      type: "number",
      admin: {
        readOnly: true,
        position: "sidebar",
        description: "Denormalized from approved reviews.",
      },
    },
    {
      name: "temporarilyClosed",
      type: "checkbox",
      defaultValue: false,
      admin: { position: "sidebar" },
    },
    {
      name: "featured",
      type: "checkbox",
      defaultValue: false,
      admin: { position: "sidebar" },
    },
    commentsEnabledField(),
    {
      name: "reviews",
      type: "join",
      collection: "reviews",
      on: "target",
    },
    {
      name: "events",
      type: "join",
      collection: "events",
      on: "location",
    },
    ...generatedImageFields(locationImages),
  ],
};
