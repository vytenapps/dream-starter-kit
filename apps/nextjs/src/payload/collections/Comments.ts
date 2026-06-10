import type { CollectionConfig } from "payload";

import { approvedOrStaff, ownsOrStaff, staffFieldAccess } from "../access";
import { requireCommentsEnabled } from "../hooks/comments-gate";

/**
 * ONE comment system for everything: the community wall (target:
 * community-posts) and comments on any content type, with threaded replies via
 * `parent` → the `replies` join. Creation is gated on the target's
 * `commentsEnabled` toggle; moderation via `status` (plain select — safe, no
 * drafts here); deletion is native soft delete (`trash: true`).
 */
export const Comments: CollectionConfig = {
  slug: "comments",
  trash: true,
  admin: {
    group: "Community",
    defaultColumns: ["author", "target", "status", "createdAt"],
    description: "Member comments across community posts and content.",
  },
  access: {
    read: approvedOrStaff,
    create: ({ req: { user } }) => Boolean(user),
    update: ownsOrStaff("author"),
    delete: ownsOrStaff("author"),
  },
  hooks: { beforeValidate: [requireCommentsEnabled] },
  fields: [
    {
      name: "author",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
    },
    {
      name: "target",
      type: "relationship",
      relationTo: [
        "community-posts",
        "posts",
        "videos",
        "audio",
        "photos",
        "events",
        "locations",
      ],
      required: true,
    },
    {
      name: "parent",
      type: "relationship",
      relationTo: "comments",
      admin: { description: "Set for threaded replies." },
    },
    { name: "body", type: "textarea", required: true },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "approved",
      index: true,
      options: [
        { label: "Pending", value: "pending" },
        { label: "Approved", value: "approved" },
        { label: "Spam", value: "spam" },
      ],
      // Members can't self-approve; moderation is staff-only.
      access: { update: staffFieldAccess },
      admin: { position: "sidebar" },
    },
    {
      name: "likeCount",
      type: "number",
      defaultValue: 0,
      admin: { readOnly: true, position: "sidebar" },
    },
    {
      name: "reportCount",
      type: "number",
      defaultValue: 0,
      admin: { readOnly: true, position: "sidebar" },
    },
    {
      name: "isPinned",
      type: "checkbox",
      defaultValue: false,
      access: { update: staffFieldAccess },
      admin: { position: "sidebar" },
    },
    { name: "editedAt", type: "date", admin: { readOnly: true } },
    {
      name: "replies",
      type: "join",
      collection: "comments",
      on: "parent",
    },
  ],
};
