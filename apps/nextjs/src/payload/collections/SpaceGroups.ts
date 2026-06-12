import type { CollectionConfig } from "payload";

import { anyone, isStaff } from "../access";
import { accessLevelField } from "../fields/access-level";
import { slugField } from "../fields/slug";

/**
 * Top-level community sections containing spaces (Circle-style "Space
 * Groups"). Nested Docs powers the group tree (`parent` + `breadcrumbs`).
 * Reads are open at the API level — the app gates rendering by `accessLevel`
 * / `requiredPlans` against the member's entitlement.
 */
export const SpaceGroups: CollectionConfig = {
  slug: "space-groups",
  trash: true,
  admin: {
    useAsTitle: "name",
    group: "Community",
    defaultColumns: ["name", "accessLevel", "order"],
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
    { name: "description", type: "textarea" },
    {
      name: "icon",
      type: "text",
      admin: { description: "Sidebar icon name." },
    },
    accessLevelField(),
    {
      name: "requiredPlans",
      type: "relationship",
      relationTo: "ext-billing-plans",
      hasMany: true,
      admin: {
        position: "sidebar",
        description: "Plans that unlock this group.",
      },
    },
    {
      name: "order",
      type: "number",
      admin: {
        position: "sidebar",
        description: "Sidebar order within the parent.",
      },
    },
    {
      name: "spaces",
      type: "join",
      collection: "community-spaces",
      on: "spaceGroup",
    },
  ],
};
