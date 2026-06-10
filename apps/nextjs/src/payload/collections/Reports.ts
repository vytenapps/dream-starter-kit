import type { CollectionConfig } from "payload";

import { isStaff } from "../access";
import { assignOwner } from "../hooks/assign-owner";
import { incrementReportCount } from "../hooks/report-count";
import { uniquePolymorphic } from "../hooks/unique-polymorphic";

/**
 * Member reports on wall posts and comments — the moderation queue. One OPEN
 * report per reporter+target (hook-enforced; resolved reports don't block a
 * re-report). Filing increments the target's `reportCount`. Resolution drives
 * the standard actions: `hidden` (reversible status) or soft delete (Trash).
 */
export const Reports: CollectionConfig = {
  slug: "reports",
  admin: {
    group: "Community",
    defaultColumns: ["reporter", "target", "reason", "status", "createdAt"],
    description: "Moderation queue for member-reported content.",
  },
  access: {
    read: isStaff,
    create: ({ req: { user } }) => Boolean(user),
    update: isStaff,
    delete: isStaff,
  },
  hooks: {
    beforeChange: [assignOwner("reporter")],
    beforeValidate: [
      uniquePolymorphic({
        collection: "reports",
        ownerField: "reporter",
        message: "You already have an open report on this item.",
        where: { status: { in: ["open", "reviewing"] } },
      }),
    ],
    afterChange: [incrementReportCount],
  },
  fields: [
    {
      name: "reporter",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
    },
    {
      name: "target",
      type: "relationship",
      relationTo: ["community-posts", "comments"],
      required: true,
    },
    {
      name: "reason",
      type: "select",
      required: true,
      options: [
        { label: "Spam", value: "spam" },
        { label: "Harassment", value: "harassment" },
        { label: "Hate", value: "hate" },
        { label: "Nudity", value: "nudity" },
        { label: "Violence", value: "violence" },
        { label: "Misinformation", value: "misinformation" },
        { label: "Other", value: "other" },
      ],
    },
    { name: "details", type: "textarea" },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "open",
      index: true,
      options: [
        { label: "Open", value: "open" },
        { label: "Reviewing", value: "reviewing" },
        { label: "Actioned", value: "actioned" },
        { label: "Dismissed", value: "dismissed" },
      ],
      admin: { position: "sidebar" },
    },
    {
      name: "resolution",
      type: "select",
      defaultValue: "none",
      options: [
        { label: "None", value: "none" },
        { label: "Hidden", value: "hidden" },
        { label: "Deleted", value: "deleted" },
        { label: "Warned", value: "warned" },
        { label: "Banned", value: "banned" },
      ],
      admin: { position: "sidebar" },
    },
    { name: "resolvedBy", type: "relationship", relationTo: "users" },
    { name: "resolvedAt", type: "date" },
  ],
};
