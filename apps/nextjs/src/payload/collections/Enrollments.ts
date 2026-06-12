import type { CollectionConfig } from "payload";

import { isStaff, ownsOrStaff } from "../access";

/**
 * Who's in a course (`series` of kind `course`) — the anchor for relative
 * drip, gating and progress. One row per user+course via a compound unique
 * index (both sides are single relationships, so the index is expressible —
 * unlike the polymorphic favorites/reports). Enrollment is staff/manual for
 * now; self-enroll arrives with the member API bridge.
 */
export const Enrollments: CollectionConfig = {
  slug: "enrollments",
  admin: {
    group: "People",
    defaultColumns: ["user", "course", "status", "enrolledAt"],
  },
  indexes: [{ fields: ["user", "course"], unique: true }],
  access: {
    read: ownsOrStaff(),
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  fields: [
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
    },
    {
      name: "course",
      type: "relationship",
      relationTo: "series",
      required: true,
      filterOptions: { kind: { equals: "course" } },
    },
    {
      name: "enrolledAt",
      type: "date",
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: { description: "Anchor for relative drip." },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "active",
      options: [
        { label: "Active", value: "active" },
        { label: "Completed", value: "completed" },
        { label: "Refunded", value: "refunded" },
        { label: "Expired", value: "expired" },
      ],
      admin: { position: "sidebar" },
    },
    {
      name: "source",
      type: "select",
      defaultValue: "manual",
      options: [
        { label: "Purchase", value: "purchase" },
        { label: "Subscription", value: "subscription" },
        { label: "Free", value: "free" },
        { label: "Manual", value: "manual" },
      ],
    },
    {
      // Billing (system extension) coupling — delete this field if you remove
      // the billing extension.
      name: "subscription",
      type: "relationship",
      relationTo: "ext-billing-subscriptions",
      admin: {
        condition: (data) => data.source === "subscription",
        description: "When access comes from a plan.",
      },
    },
    {
      name: "progress",
      type: "array",
      fields: [
        {
          name: "lesson",
          type: "relationship",
          relationTo: "lessons",
          required: true,
        },
        { name: "completedAt", type: "date" },
        { name: "percent", type: "number", min: 0, max: 100 },
      ],
    },
  ],
};
