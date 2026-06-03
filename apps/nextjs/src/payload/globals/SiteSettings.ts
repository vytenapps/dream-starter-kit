import type { GlobalConfig } from "payload";

import { anyone, isAdmin } from "../access";

/** Site-wide chrome consumed by the public layout: header nav, footer links,
 *  social handles. A true singleton — the correct use case for a global. */
export const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  admin: { group: "Admin" },
  access: { read: anyone, update: isAdmin },
  fields: [
    {
      name: "header",
      type: "array",
      label: "Header nav",
      fields: [
        { name: "label", type: "text", required: true },
        { name: "url", type: "text", required: true },
      ],
    },
    {
      name: "footer",
      type: "array",
      label: "Footer links",
      fields: [
        { name: "label", type: "text", required: true },
        { name: "url", type: "text", required: true },
      ],
    },
    {
      name: "social",
      type: "group",
      fields: [
        { name: "twitter", type: "text" },
        { name: "github", type: "text" },
      ],
    },
  ],
};
