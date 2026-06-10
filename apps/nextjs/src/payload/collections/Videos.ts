import type { CollectionConfig } from "payload";

import { isStaff, publishedOrStaff } from "../access";
import { accessLevelField } from "../fields/access-level";
import { commentsEnabledField } from "../fields/comments-enabled";
import { slugField } from "../fields/slug";

const CAPTION_LANGUAGES = [
  { label: "English", value: "en" },
  { label: "Spanish", value: "es" },
  { label: "French", value: "fr" },
  { label: "German", value: "de" },
  { label: "Portuguese", value: "pt" },
  { label: "Italian", value: "it" },
  { label: "Japanese", value: "ja" },
  { label: "Korean", value: "ko" },
  { label: "Chinese (Simplified)", value: "zh" },
];

/**
 * One collection for both landscape 16:9 video and vertical shorts
 * (Reels/Shorts-style), discriminated by `orientation`. The app renders a
 * standard player for `landscape` and a swipe feed for `vertical`
 * (`where[orientation][equals]=vertical`).
 */
export const Videos: CollectionConfig = {
  slug: "videos",
  trash: true,
  folders: true,
  admin: {
    useAsTitle: "title",
    group: "Content",
    defaultColumns: ["title", "orientation", "series", "_status"],
    listSearchableFields: ["title", "description"],
  },
  versions: { drafts: { schedulePublish: true }, maxPerDoc: 25 },
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
    {
      name: "body",
      type: "richText",
      admin: { description: "Show notes (optional)." },
    },
    {
      name: "orientation",
      type: "select",
      required: true,
      defaultValue: "landscape",
      options: [
        { label: "Landscape (16:9)", value: "landscape" },
        { label: "Vertical short (9:16)", value: "vertical" },
      ],
      admin: { description: "Drives the player and which feed this is in." },
    },
    {
      name: "aspectRatio",
      type: "select",
      options: [
        { label: "16:9", value: "16:9" },
        { label: "9:16", value: "9:16" },
        { label: "1:1", value: "1:1" },
        { label: "4:5", value: "4:5" },
      ],
      admin: { description: "Defaults from orientation when unset." },
    },
    {
      name: "sourceType",
      type: "select",
      required: true,
      defaultValue: "url",
      options: [
        { label: "External URL", value: "url" },
        { label: "Uploaded file", value: "upload" },
        { label: "Mux", value: "mux" },
        { label: "YouTube", value: "youtube" },
        { label: "Vimeo", value: "vimeo" },
      ],
    },
    {
      name: "url",
      type: "text",
      admin: {
        condition: (data) => data.sourceType !== "upload",
        description: "External URL or provider playback ID.",
      },
    },
    {
      name: "videoFile",
      type: "upload",
      relationTo: "media",
      admin: { condition: (data) => data.sourceType === "upload" },
    },
    {
      name: "thumbnail",
      type: "upload",
      relationTo: "media",
      admin: { description: "Landscape poster (16:9)." },
    },
    {
      name: "verticalThumbnail",
      type: "upload",
      relationTo: "media",
      admin: {
        condition: (data) => data.orientation === "vertical",
        description: "Portrait poster for the shorts feed.",
      },
    },
    {
      name: "previewClip",
      type: "upload",
      relationTo: "media",
      admin: { description: "Muted autoplay loop for feeds (optional)." },
    },
    {
      name: "duration",
      type: "number",
      min: 0,
      admin: { description: "Length in seconds." },
    },
    {
      name: "captions",
      type: "array",
      fields: [
        { name: "label", type: "text", required: true },
        { name: "language", type: "select", options: CAPTION_LANGUAGES },
        { name: "file", type: "upload", relationTo: "media" },
      ],
    },
    {
      name: "chapters",
      type: "array",
      admin: { description: "Long-form landscape only." },
      fields: [
        { name: "title", type: "text", required: true },
        {
          name: "startTime",
          type: "number",
          required: true,
          min: 0,
          admin: { description: "Seconds from the start." },
        },
      ],
    },
    { name: "series", type: "relationship", relationTo: "series" },
    {
      type: "row",
      fields: [
        { name: "episodeNumber", type: "number", min: 0 },
        { name: "seasonNumber", type: "number", min: 0 },
      ],
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
