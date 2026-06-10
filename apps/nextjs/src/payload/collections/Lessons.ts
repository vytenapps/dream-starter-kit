import type { CollectionConfig } from "payload";

import { isStaff, publishedOrStaff } from "../access";
import { slugField } from "../fields/slug";

/**
 * Individual course lessons, grouped into modules and drip-released. A lesson
 * belongs to a `series` of kind `course`; release is computed per enrolled
 * user (see `enrollments.enrolledAt` for relative drip). `unlocksAt` is a
 * computed convenience for countdowns — for `scheduled` drip it's `releaseAt`;
 * per-user relative release is resolved by the app from the enrollment.
 */
export const Lessons: CollectionConfig = {
  slug: "lessons",
  trash: true,
  folders: true,
  admin: {
    useAsTitle: "title",
    group: "Content",
    defaultColumns: ["title", "course", "module", "order", "_status"],
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
    {
      name: "course",
      type: "relationship",
      relationTo: "series",
      required: true,
      filterOptions: { kind: { equals: "course" } },
    },
    {
      name: "module",
      type: "text",
      admin: { description: "Section/module label for grouping." },
    },
    {
      name: "order",
      type: "number",
      admin: {
        position: "sidebar",
        description: "Sequence within the course.",
      },
    },
    { name: "content", type: "richText" },
    { name: "video", type: "relationship", relationTo: "videos" },
    { name: "audio", type: "relationship", relationTo: "audio" },
    {
      name: "attachments",
      type: "upload",
      relationTo: "media",
      hasMany: true,
      admin: { description: "Downloadable resources." },
    },
    {
      name: "duration",
      type: "number",
      min: 0,
      admin: { description: "Estimated minutes." },
    },
    {
      name: "preview",
      type: "checkbox",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description: "Free preview — bypasses gating.",
      },
    },
    {
      name: "dripType",
      type: "select",
      defaultValue: "none",
      options: [
        { label: "Immediate", value: "none" },
        { label: "Scheduled (absolute date)", value: "scheduled" },
        { label: "Relative (days after enrollment)", value: "relative" },
      ],
    },
    {
      name: "releaseAt",
      type: "date",
      admin: {
        condition: (data) => data.dripType === "scheduled",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "releaseAfterDays",
      type: "number",
      min: 0,
      admin: { condition: (data) => data.dripType === "relative" },
    },
    {
      name: "dripMode",
      type: "select",
      defaultValue: "gate_content",
      options: [
        { label: "Gate content (locked until release)", value: "gate_content" },
        { label: "Notify only (always available)", value: "notify_only" },
      ],
    },
    { name: "notifyPush", type: "checkbox", defaultValue: false },
    { name: "notifyEmail", type: "checkbox", defaultValue: false },
    {
      name: "unlocksAt",
      type: "date",
      virtual: true,
      admin: {
        readOnly: true,
        description:
          "Computed release time for countdowns (scheduled drip only; " +
          "relative drip is resolved per user from the enrollment).",
      },
      hooks: {
        afterRead: [
          ({ siblingData }) =>
            (siblingData as { dripType?: string; releaseAt?: string | null })
              .dripType === "scheduled"
              ? ((siblingData as { releaseAt?: string | null }).releaseAt ??
                null)
              : null,
        ],
      },
    },
  ],
};
