import type { CollectionConfig } from "payload";

import { anyone, isStaff } from "../access";

/**
 * The CMS-driven app menu (docs/EXTENSIONS-PLAN.md §2.5) — one row per menu
 * entry, core entries included, so staff rename / drag-reorder / re-icon /
 * toggle the WHOLE menu uniformly from /admin without a deploy.
 *
 * Rows are created/deleted only by the boot-time reconcile
 * (lib/ext/reconcile-nav.ts) from the manifest nav defaults; label/icon/
 * platforms/enabled/order are staff-owned after creation and never
 * overwritten by reconcile or extension updates.
 *
 * Public read: the native app renders its menu from this collection over
 * /cms-api REST (`useNavMenu()` in @acme/app).
 */
export const NavItems: CollectionConfig = {
  slug: "nav-items",
  labels: { singular: "Nav Item", plural: "Nav Items" },
  orderable: true,
  admin: {
    group: "Extensions",
    useAsTitle: "label",
    defaultColumns: ["label", "href", "platforms", "enabled"],
    description:
      "The app menu (web sidebar + native home). Drag to reorder; rename, change icons, or toggle items. New extensions add their entries here automatically on install.",
  },
  access: {
    read: anyone,
    update: isStaff,
    create: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: "key",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true, hidden: true },
    },
    {
      name: "extension",
      type: "relationship",
      relationTo: "kit-extensions",
      admin: {
        readOnly: true,
        position: "sidebar",
        description: "Empty for core entries.",
      },
    },
    { name: "label", type: "text", required: true },
    { name: "href", type: "text", required: true, admin: { readOnly: true } },
    {
      name: "icon",
      type: "text",
      admin: {
        description:
          "Icon name from the kit's icon map (e.g. IconMessageCircle). Unknown names fall back to a default icon.",
      },
    },
    {
      name: "platforms",
      type: "select",
      hasMany: true,
      options: [
        { label: "Web", value: "web" },
        { label: "Native", value: "native" },
      ],
      defaultValue: ["web", "native"],
    },
    { name: "enabled", type: "checkbox", defaultValue: true },
  ],
};
