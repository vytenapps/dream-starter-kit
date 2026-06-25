import type { CollectionConfig } from "payload";

import { approvedOrStaff, ownsOrStaff, staffFieldAccess } from "../access";
import { assignOwner } from "../hooks/assign-owner";

/**
 * Member reviews with a 1–5 rating, photos and an owner/staff response —
 * for locations and events. Public reads see approved reviews only.
 */
export const Reviews: CollectionConfig = {
  slug: "reviews",
  trash: true,
  admin: {
    group: "People",
    defaultColumns: ["author", "target", "rating", "status", "createdAt"],
  },
  access: {
    read: approvedOrStaff,
    create: ({ req: { user } }) => Boolean(user),
    update: ownsOrStaff("author"),
    delete: ownsOrStaff("author"),
  },
  hooks: { beforeChange: [assignOwner("author")] },
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
      relationTo: ["locations", "events"],
      // Optional: a review of a location/event sets a target, but a standalone
      // marketing testimonial (e.g. featured on the checkout page) has none.
      admin: {
        description:
          "The location or event this review is about. Leave empty for a standalone testimonial.",
      },
    },
    { name: "rating", type: "number", required: true, min: 1, max: 5 },
    { name: "title", type: "text" },
    {
      name: "authorTitle",
      type: "text",
      admin: {
        description:
          "Optional role/title shown under the author's name when this review is used as a testimonial (e.g. “CEO at Acme”).",
      },
    },
    { name: "body", type: "textarea" },
    {
      name: "photos",
      type: "upload",
      relationTo: "media",
      hasMany: true,
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      index: true,
      options: [
        { label: "Pending", value: "pending" },
        { label: "Approved", value: "approved" },
        { label: "Rejected", value: "rejected" },
      ],
      access: { update: staffFieldAccess },
      admin: { position: "sidebar" },
    },
    {
      name: "helpfulCount",
      type: "number",
      defaultValue: 0,
      admin: { readOnly: true, position: "sidebar" },
    },
    {
      name: "verifiedVisit",
      type: "checkbox",
      defaultValue: false,
      access: { update: staffFieldAccess },
      admin: { position: "sidebar" },
    },
    {
      name: "response",
      type: "group",
      access: { update: staffFieldAccess },
      admin: { description: "Owner/staff response shown under the review." },
      fields: [
        { name: "body", type: "textarea" },
        { name: "respondedBy", type: "relationship", relationTo: "users" },
        { name: "respondedAt", type: "date" },
      ],
    },
  ],
};
