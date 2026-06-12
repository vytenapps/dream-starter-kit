import type { CollectionConfig } from "payload";

import { anyone, isAdmin } from "../access";

/**
 * Framework-owned registry of installed extensions (docs/EXTENSIONS-PLAN.md
 * §2.5) — one row per extension, created/updated ONLY by the boot-time
 * reconcile (lib/ext/reconcile-nav.ts, Local API with overrideAccess). Staff
 * use it for the runtime Enable/Disable toggle; `pnpm ext remove` is the real
 * uninstall.
 *
 * Read access is public: the native app reads `enabled` to filter its menu,
 * and the only data here is slug/name/version metadata already shipped in the
 * client bundle's generated registry.
 */
export const KitExtensions: CollectionConfig = {
  slug: "kit-extensions",
  labels: { singular: "Extension", plural: "Extensions" },
  admin: {
    group: "Extensions",
    useAsTitle: "name",
    defaultColumns: ["name", "slug", "version", "enabled"],
    description:
      "Installed extensions. Disabling hides an extension's menu items and 404s its pages and API at runtime without uninstalling it.",
  },
  access: {
    read: anyone,
    update: isAdmin,
    create: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true },
    },
    { name: "name", type: "text", required: true, admin: { readOnly: true } },
    {
      name: "version",
      type: "text",
      required: true,
      admin: {
        readOnly: true,
        description: "Mirrored from the bundled extensions.lock at boot.",
      },
    },
    {
      name: "enabled",
      type: "checkbox",
      defaultValue: true,
      admin: {
        description:
          "Uncheck to hide this extension from menus and block its pages/API. Code stays deployed; re-enable any time.",
      },
    },
    {
      name: "system",
      type: "checkbox",
      defaultValue: false,
      admin: {
        readOnly: true,
        description:
          "The app shell depends on this extension's mounts (e.g. the home screen) — disabling it will break core navigation.",
      },
    },
  ],
};
