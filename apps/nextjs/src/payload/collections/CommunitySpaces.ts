import type { CollectionConfig } from "payload";

import { anyone, isStaff } from "../access";
import { accessLevelField } from "../fields/access-level";
import { slugField } from "../fields/slug";

/**
 * The spaces/channels inside a space group — the leaves of the community
 * sidebar. `parentSpace` is a plain self-relationship (deliberately NOT a
 * second Nested Docs instance — sub-spaces are optional; promote it to the
 * plugin if you need breadcrumbs). The app gates rendering by `accessLevel`
 * / `requiredPlans` (and the parent group's).
 */
export const CommunitySpaces: CollectionConfig = {
  slug: "community-spaces",
  trash: true,
  admin: {
    useAsTitle: "name",
    group: "Community",
    defaultColumns: ["name", "spaceGroup", "accessLevel", "order"],
  },
  defaultPopulate: { name: true, slug: true, accessLevel: true },
  access: {
    read: anyone,
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  fields: [
    { name: "name", type: "text", required: true },
    slugField("name"),
    {
      name: "spaceGroup",
      type: "relationship",
      relationTo: "space-groups",
      index: true,
      admin: { description: "Which group/section this space sits in." },
    },
    {
      name: "parentSpace",
      type: "relationship",
      relationTo: "community-spaces",
      admin: { description: "Optional sub-space." },
    },
    { name: "description", type: "textarea" },
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      admin: { description: "Space banner/icon." },
    },
    accessLevelField(),
    {
      name: "requiredPlans",
      type: "relationship",
      relationTo: "ext-billing-plans",
      hasMany: true,
      admin: {
        position: "sidebar",
        description: "Plans that unlock a premium space.",
      },
    },
    {
      name: "postingPolicy",
      type: "select",
      required: true,
      defaultValue: "members",
      options: [
        { label: "All members", value: "members" },
        { label: "Moderators", value: "moderators" },
        { label: "Admins", value: "admins" },
      ],
    },
    {
      name: "moderators",
      type: "relationship",
      relationTo: "users",
      hasMany: true,
    },
    {
      name: "order",
      type: "number",
      admin: {
        position: "sidebar",
        description: "Sidebar order within the group.",
      },
    },
    {
      name: "posts",
      type: "join",
      collection: "community-posts",
      on: "space",
    },
  ],
};
