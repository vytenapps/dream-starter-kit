import type { CollectionConfig } from "payload";

import { isAdmin } from "../access";

/**
 * Payload admin users (content editors / staff). This is the CMS's OWN auth,
 * entirely separate from Supabase Auth (which authenticates app users). The two
 * never share a session — see docs/ARCHITECTURE.md ("two-backend split").
 */
export const Users: CollectionConfig = {
  slug: "users",
  auth: true,
  admin: { useAsTitle: "email", group: "Admin" },
  access: {
    create: isAdmin,
    read: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: "name", type: "text" },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "editor",
      saveToJWT: true,
      options: [
        { label: "Admin", value: "admin" },
        { label: "Editor", value: "editor" },
      ],
    },
  ],
};
