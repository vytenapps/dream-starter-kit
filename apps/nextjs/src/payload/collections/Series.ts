import type { CollectionConfig } from "payload";

import { CARD_FORMATS } from "../../lib/image-formats";
import { isStaff, publishedOrStaff } from "../access";
import { accessLevelField } from "../fields/access-level";
import { generatedImageFields } from "../fields/generated-images";
import { slugField } from "../fields/slug";
import { generateImagesHook, syncImageUrls } from "../hooks/generate-images";

/** AI image generation: hero + OG + a square cover from the series' imagePrompt. */
const seriesImages = { formats: CARD_FORMATS };

/** Apple Podcasts top-level categories (shared by category + subcategory). */
const APPLE_PODCAST_CATEGORIES = [
  "Arts",
  "Business",
  "Comedy",
  "Education",
  "Fiction",
  "Government",
  "Health & Fitness",
  "History",
  "Kids & Family",
  "Leisure",
  "Music",
  "News",
  "Religion & Spirituality",
  "Science",
  "Society & Culture",
  "Sports",
  "TV & Film",
  "Technology",
  "True Crime",
].map((label) => ({
  label,
  value: label.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
}));

/**
 * Groups episodic media, curated playlists/albums, podcast shows and drip
 * courses, discriminated by `kind`. Channel-level podcast RSS metadata lives in
 * the conditional `podcast` group; course/drip settings in `course`. Episodes
 * and lessons point back here (`videos.series`, `audio.series`,
 * `lessons.course`) and surface through the join fields.
 */
export const Series: CollectionConfig = {
  slug: "series",
  trash: true,
  folders: true,
  admin: {
    useAsTitle: "title",
    group: "Content",
    defaultColumns: ["title", "kind", "_status"],
  },
  versions: { drafts: { schedulePublish: true }, maxPerDoc: 25 },
  defaultPopulate: { title: true, slug: true, kind: true },
  access: {
    read: publishedOrStaff,
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  hooks: {
    beforeChange: [
      generateImagesHook(seriesImages),
      syncImageUrls(seriesImages),
    ],
  },
  fields: [
    { name: "title", type: "text", required: true },
    slugField(),
    {
      name: "kind",
      type: "select",
      required: true,
      defaultValue: "series",
      options: [
        { label: "Series", value: "series" },
        { label: "Season", value: "season" },
        { label: "Playlist", value: "playlist" },
        { label: "Album", value: "album" },
        { label: "Podcast show", value: "podcast" },
        { label: "Course", value: "course" },
      ],
    },
    { name: "description", type: "richText" },
    { name: "coverArt", type: "upload", relationTo: "media" },
    { name: "featuredImage", type: "upload", relationTo: "media" },
    {
      name: "parentSeries",
      type: "relationship",
      relationTo: "series",
      admin: { description: "Seasons under a parent series." },
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
      name: "requiredPlans",
      type: "relationship",
      relationTo: "ext-billing-plans",
      hasMany: true,
      admin: {
        position: "sidebar",
        description: "Plans that unlock this show/course (premium gating).",
      },
    },
    { name: "displayOrder", type: "number", admin: { position: "sidebar" } },
    {
      name: "featured",
      type: "checkbox",
      defaultValue: false,
      admin: { position: "sidebar" },
    },
    {
      // Podcast show (channel) metadata → the RSS <channel> + itunes:/podcast:
      // namespaces. Episode-level fields live on `audio`.
      name: "podcast",
      type: "group",
      admin: { condition: (data) => data.kind === "podcast" },
      fields: [
        { name: "itunesAuthor", type: "text" },
        {
          name: "owner",
          type: "group",
          fields: [
            { name: "name", type: "text" },
            { name: "email", type: "email" },
          ],
        },
        { name: "summary", type: "textarea" },
        {
          name: "artwork",
          type: "upload",
          relationTo: "media",
          admin: { description: "Square show art, ≥1400×1400." },
        },
        {
          name: "category",
          type: "select",
          options: APPLE_PODCAST_CATEGORIES,
        },
        {
          name: "subcategory",
          type: "select",
          options: APPLE_PODCAST_CATEGORIES,
        },
        { name: "explicit", type: "checkbox", defaultValue: false },
        {
          name: "type",
          type: "select",
          defaultValue: "episodic",
          options: [
            { label: "Episodic", value: "episodic" },
            { label: "Serial", value: "serial" },
          ],
        },
        { name: "language", type: "text", defaultValue: "en" },
        { name: "copyright", type: "text" },
        {
          name: "link",
          type: "text",
          admin: { description: "Show website URL." },
        },
        {
          name: "podcastGuid",
          type: "text",
          admin: { description: "Stable UUID for podcast:guid." },
        },
        { name: "locked", type: "checkbox", defaultValue: false },
        {
          name: "lockedOwner",
          type: "email",
          admin: { condition: (_, s) => Boolean(s.locked) },
        },
        {
          name: "funding",
          type: "array",
          fields: [
            { name: "url", type: "text", required: true },
            { name: "label", type: "text" },
          ],
        },
        { name: "complete", type: "checkbox", defaultValue: false },
        { name: "newFeedUrl", type: "text" },
        {
          name: "isPrivate",
          type: "checkbox",
          defaultValue: false,
          admin: {
            description:
              "Members-only feed (forces itunes:block; served via feed-tokens).",
          },
        },
      ],
    },
    {
      // Course/drip settings (kind: course). Lessons point back via
      // lessons.course; enrollment anchors relative drip.
      name: "course",
      type: "group",
      admin: { condition: (data) => data.kind === "course" },
      fields: [
        {
          name: "instructors",
          type: "relationship",
          relationTo: "users",
          hasMany: true,
        },
        { name: "summary", type: "textarea" },
        { name: "dripEnabled", type: "checkbox", defaultValue: false },
        {
          name: "dripAnchor",
          type: "select",
          defaultValue: "enrollment",
          options: [
            { label: "Enrollment (relative)", value: "enrollment" },
            { label: "Fixed date (absolute)", value: "fixed_date" },
          ],
        },
        {
          name: "certificateOnComplete",
          type: "checkbox",
          defaultValue: false,
        },
        { name: "estimatedHours", type: "number", min: 0 },
      ],
    },
    {
      name: "videoEpisodes",
      type: "join",
      collection: "videos",
      on: "series",
    },
    {
      name: "audioEpisodes",
      type: "join",
      collection: "audio",
      on: "series",
    },
    {
      name: "lessons",
      type: "join",
      collection: "lessons",
      on: "course",
    },
    ...generatedImageFields(seriesImages),
  ],
};
