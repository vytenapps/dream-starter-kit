import type { CollectionConfig } from "payload";

import { anyone, isStaff } from "../access";
import { accessLevelField } from "../fields/access-level";
import { commentsEnabledField } from "../fields/comments-enabled";
import { generatedImageFields } from "../fields/generated-images";
import { slugField } from "../fields/slug";
import { generateImagesHook, syncImageUrls } from "../hooks/generate-images";
import { audioImages } from "../image-collections";

/**
 * Podcast/audio episodes — an UPLOAD collection: the row IS the audio binary
 * (→ the RSS <enclosure> url/length/type), offloaded to object storage by the
 * S3 adapter. Episode-level podcast RSS fields live here; show-level (channel)
 * metadata lives on the parent `series` with `kind: podcast`. No drafts — the
 * app filters by `publishedAt`/`accessLevel`; premium episodes are served via
 * tokenized private feeds (see `feed-tokens`).
 */
export const Audio: CollectionConfig = {
  slug: "audio",
  trash: true,
  folders: true,
  upload: { mimeTypes: ["audio/*"] },
  admin: {
    useAsTitle: "title",
    group: "Content",
    defaultColumns: ["title", "series", "episodeNumber", "publishedAt"],
    listSearchableFields: ["title", "description"],
  },
  access: {
    read: anyone,
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  hooks: {
    beforeChange: [generateImagesHook(audioImages), syncImageUrls(audioImages)],
  },
  fields: [
    { name: "title", type: "text", required: true },
    slugField(),
    {
      name: "guid",
      type: "text",
      unique: true,
      index: true,
      admin: {
        description:
          "Stable RSS <guid> (isPermaLink false) — never change once published.",
      },
    },
    { name: "subtitle", type: "text" },
    {
      name: "description",
      type: "textarea",
      admin: { description: "itunes:summary / <description>." },
    },
    {
      name: "body",
      type: "richText",
      admin: { description: "Show notes → content:encoded." },
    },
    {
      name: "coverArt",
      type: "upload",
      relationTo: "media",
      admin: {
        description:
          "Square episode art (≥1400×1400); falls back to the show art.",
      },
    },
    {
      name: "duration",
      type: "number",
      min: 0,
      admin: { description: "Seconds → itunes:duration." },
    },
    {
      type: "row",
      fields: [
        { name: "episodeNumber", type: "number", min: 0 },
        { name: "seasonNumber", type: "number", min: 0 },
      ],
    },
    {
      name: "episodeType",
      type: "select",
      defaultValue: "full",
      options: [
        { label: "Full", value: "full" },
        { label: "Trailer", value: "trailer" },
        { label: "Bonus", value: "bonus" },
      ],
    },
    { name: "explicit", type: "checkbox", defaultValue: false },
    {
      name: "transcript",
      type: "richText",
      admin: { disableListColumn: true },
    },
    {
      name: "transcriptFile",
      type: "upload",
      relationTo: "media",
      admin: { description: "podcast:transcript file (VTT/SRT/JSON)." },
    },
    {
      name: "chapters",
      type: "array",
      fields: [
        { name: "title", type: "text", required: true },
        { name: "startTime", type: "number", required: true, min: 0 },
      ],
    },
    {
      name: "soundbites",
      type: "array",
      fields: [
        { name: "startTime", type: "number", required: true, min: 0 },
        { name: "duration", type: "number", required: true, min: 0 },
        { name: "title", type: "text" },
      ],
    },
    {
      name: "series",
      type: "relationship",
      relationTo: "series",
      admin: {
        description: "The show (kind: podcast) this episode belongs to.",
      },
    },
    {
      name: "itunesBlock",
      type: "checkbox",
      defaultValue: false,
      admin: { description: "Hide this single episode from directories." },
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
        description: "RSS <pubDate>.",
      },
    },
    ...generatedImageFields(audioImages),
  ],
};
