import type { CollectionConfig } from "payload";

import { ownsOrStaff, staffFieldAccess } from "../access";
import { accessLevelField } from "../fields/access-level";
import { commentsEnabledField } from "../fields/comments-enabled";
import { destinationField } from "../fields/destination";

/**
 * Member-authored posts on the community wall (distinct from editorial
 * `posts`). No drafts — moderation `status` (plain select, safe without
 * versions) + native soft delete (`trash: true`, so mods can soft-delete any
 * post and restore from the Trash). Threaded discussion comes from the shared
 * `comments` collection (target → this post).
 */
export const CommunityPosts: CollectionConfig = {
  slug: "community-posts",
  trash: true,
  admin: {
    useAsTitle: "title",
    group: "Community",
    defaultColumns: ["title", "authorName", "space", "status", "publishedAt"],
  },
  access: {
    // Hidden/flagged posts drop out of member feeds; staff see everything.
    read: ({ req: { user } }) => {
      if (user?.roles.some((r) => ["admin", "editor"].includes(r))) return true;
      return { status: { equals: "published" } };
    },
    create: ({ req: { user } }) => Boolean(user),
    update: ownsOrStaff("author"),
    delete: ownsOrStaff("author"),
  },
  fields: [
    {
      name: "author",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
    },
    {
      name: "space",
      type: "relationship",
      relationTo: "community-spaces",
      index: true,
      admin: { description: "Optional — which space/channel." },
    },
    {
      name: "title",
      type: "text",
      admin: { description: "Optional — feeds fall back to a body excerpt." },
    },
    { name: "body", type: "richText" },
    {
      name: "media",
      type: "upload",
      relationTo: "media",
      hasMany: true,
      admin: { description: "Image/video attachments." },
    },
    destinationField("link"),
    { name: "tags", type: "relationship", relationTo: "tags", hasMany: true },
    accessLevelField(),
    commentsEnabledField(true),
    {
      name: "pinned",
      type: "checkbox",
      defaultValue: false,
      access: { update: staffFieldAccess },
      admin: { position: "sidebar", description: "Mods pin to top." },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "published",
      index: true,
      options: [
        { label: "Published", value: "published" },
        { label: "Pending", value: "pending" },
        { label: "Hidden", value: "hidden" },
        { label: "Flagged", value: "flagged" },
      ],
      access: { update: staffFieldAccess },
      admin: { position: "sidebar" },
    },
    {
      type: "row",
      fields: [
        {
          name: "likeCount",
          type: "number",
          defaultValue: 0,
          admin: { readOnly: true },
        },
        {
          name: "commentCount",
          type: "number",
          defaultValue: 0,
          admin: { readOnly: true },
        },
        {
          name: "reportCount",
          type: "number",
          defaultValue: 0,
          admin: { readOnly: true },
        },
      ],
    },
    {
      // Flattens the author into feed lists without a populate.
      name: "authorName",
      type: "text",
      virtual: "author.displayName",
    },
    {
      name: "publishedAt",
      type: "date",
      index: true,
      admin: { position: "sidebar" },
    },
    {
      name: "comments",
      type: "join",
      collection: "comments",
      on: "target",
    },
    {
      name: "reports",
      type: "join",
      collection: "reports",
      on: "target",
    },
  ],
};
