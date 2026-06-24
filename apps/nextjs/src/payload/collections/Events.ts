import type { CollectionConfig } from "payload";
import { defaultTimezones } from "payload/shared";

import { generatePreviewPath, previewBreakpoints } from "../../lib/preview";
import { isStaff, publishedOrStaff } from "../access";
import { commentsEnabledField } from "../fields/comments-enabled";
import { generatedImageFields } from "../fields/generated-images";
import { slugField } from "../fields/slug";
import { generateImagesHook, syncImageUrls } from "../hooks/generate-images";
import { eventImages } from "../image-collections";

const CURRENCIES = ["usd", "eur", "gbp", "cad", "aud"].map((c) => ({
  label: c.toUpperCase(),
  value: c,
}));

/**
 * Events. TWO statuses by design: editorial `_status` (draft/published, added
 * by drafts) vs. lifecycle `eventStatus` (scheduled/cancelled/…). The
 * lifecycle field is `eventStatus`, NOT `status` — `status` is reserved on the
 * Postgres adapter when drafts are enabled (collides with the drafts column).
 */
export const Events: CollectionConfig = {
  slug: "events",
  trash: true,
  folders: true,
  admin: {
    useAsTitle: "title",
    group: "Content",
    defaultColumns: ["title", "startsAt", "eventStatus", "_status"],
    listSearchableFields: ["title", "shortDescription"],
    // Live Preview: the admin iframe loads /next/preview, which enables draft
    // mode and renders the event's draft (see lib/preview + /next/preview route).
    livePreview: {
      url: ({ data }) =>
        generatePreviewPath({
          collection: "events",
          slug: typeof data.slug === "string" ? data.slug : undefined,
        }),
      breakpoints: previewBreakpoints,
    },
    preview: (doc) =>
      generatePreviewPath({
        collection: "events",
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
    beforeChange: [generateImagesHook(eventImages), syncImageUrls(eventImages)],
  },
  fields: [
    { name: "title", type: "text", required: true },
    slugField(),
    {
      name: "shortDescription",
      type: "textarea",
      admin: { description: "Card text." },
    },
    { name: "description", type: "richText" },
    {
      name: "eventType",
      type: "relationship",
      relationTo: "categories",
    },
    {
      name: "startsAt",
      type: "date",
      required: true,
      index: true,
      admin: { date: { pickerAppearance: "dayAndTime" } },
    },
    {
      name: "endsAt",
      type: "date",
      admin: { date: { pickerAppearance: "dayAndTime" } },
    },
    { name: "allDay", type: "checkbox", defaultValue: false },
    {
      name: "timezone",
      type: "select",
      options: [...defaultTimezones],
    },
    {
      name: "recurrence",
      type: "group",
      admin: { description: "Optional recurring schedule." },
      fields: [
        {
          name: "frequency",
          type: "select",
          options: [
            { label: "Daily", value: "daily" },
            { label: "Weekly", value: "weekly" },
            { label: "Monthly", value: "monthly" },
            { label: "Yearly", value: "yearly" },
          ],
        },
        {
          name: "interval",
          type: "number",
          min: 1,
          admin: { description: "Every N periods." },
        },
        { name: "until", type: "date" },
      ],
    },
    { name: "isVirtual", type: "checkbox", defaultValue: false },
    {
      name: "location",
      type: "relationship",
      relationTo: "locations",
      admin: { condition: (data) => !data.isVirtual },
    },
    {
      name: "virtualUrl",
      type: "text",
      admin: { condition: (data) => Boolean(data.isVirtual) },
    },
    { name: "featuredImage", type: "upload", relationTo: "media" },
    {
      name: "gallery",
      type: "upload",
      relationTo: "media",
      hasMany: true,
    },
    { name: "isFree", type: "checkbox", defaultValue: false },
    {
      type: "row",
      fields: [
        {
          name: "price",
          type: "number",
          min: 0,
          admin: { condition: (data) => !data.isFree },
        },
        {
          name: "currency",
          type: "select",
          options: CURRENCIES,
          admin: { condition: (data) => !data.isFree },
        },
      ],
    },
    { name: "ticketUrl", type: "text" },
    { name: "capacity", type: "number", min: 0 },
    {
      name: "registrationRequired",
      type: "checkbox",
      defaultValue: false,
    },
    { name: "organizer", type: "relationship", relationTo: "users" },
    {
      name: "speakers",
      type: "relationship",
      relationTo: "users",
      hasMany: true,
    },
    {
      name: "eventStatus",
      type: "select",
      defaultValue: "scheduled",
      options: [
        { label: "Scheduled", value: "scheduled" },
        { label: "Rescheduled", value: "rescheduled" },
        { label: "Cancelled", value: "cancelled" },
        { label: "Sold out", value: "sold_out" },
      ],
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
      name: "publishedAt",
      type: "date",
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    ...generatedImageFields(eventImages),
  ],
};
