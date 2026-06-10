import type { GlobalConfig } from "payload";

import { anyone, isStaff } from "../access";
import { BUTTON_VARIANTS } from "../blocks/shared";

/**
 * Site-wide chrome consumed by the public layout (Launch UI Navbar + Footer):
 * the header nav (with optional dropdown sub-menus), header action buttons,
 * footer link columns, and social handles. A true singleton — the correct use
 * case for a global. The site name/logo come from the `theme-settings` branding
 * (see `getBranding()`), not here.
 */
export const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  admin: { group: "System" },
  access: { read: anyone, update: isStaff },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "General",
          fields: [
            {
              name: "siteName",
              type: "text",
              admin: {
                description:
                  "Canonical site name for meta/SEO. The DISPLAYED app " +
                  "name/logo come from theme-settings branding (getBranding()).",
              },
            },
            {
              name: "siteDescription",
              type: "textarea",
              admin: { description: "Default meta-description fallback." },
            },
            { name: "contactEmail", type: "email" },
            {
              name: "defaultMeta",
              type: "group",
              admin: {
                description:
                  "Default Open Graph/meta values for pages without their own.",
              },
              fields: [
                { name: "title", type: "text" },
                { name: "description", type: "textarea" },
                { name: "image", type: "upload", relationTo: "media" },
              ],
            },
          ],
        },
        {
          label: "Header",
          fields: [
            {
              name: "header",
              type: "array",
              label: "Header nav",
              admin: {
                description:
                  "Top-level nav items. Add sub-items to render a dropdown menu.",
              },
              fields: [
                {
                  type: "row",
                  fields: [
                    {
                      name: "label",
                      type: "text",
                      required: true,
                      admin: { width: "50%" },
                    },
                    {
                      name: "url",
                      type: "text",
                      required: true,
                      admin: { width: "50%" },
                    },
                  ],
                },
                {
                  name: "submenu",
                  type: "array",
                  label: "Sub-menu",
                  fields: [
                    {
                      type: "row",
                      fields: [
                        {
                          name: "label",
                          type: "text",
                          required: true,
                          admin: { width: "50%" },
                        },
                        {
                          name: "url",
                          type: "text",
                          required: true,
                          admin: { width: "50%" },
                        },
                      ],
                    },
                    { name: "description", type: "text" },
                  ],
                },
              ],
            },
            {
              name: "headerActions",
              type: "array",
              label: "Header actions (right side)",
              admin: {
                description:
                  "Right-aligned links/buttons, e.g. Sign in and Get started.",
              },
              fields: [
                {
                  type: "row",
                  fields: [
                    {
                      name: "label",
                      type: "text",
                      required: true,
                      admin: { width: "40%" },
                    },
                    {
                      name: "url",
                      type: "text",
                      required: true,
                      admin: { width: "35%" },
                    },
                    {
                      name: "variant",
                      type: "select",
                      defaultValue: "default",
                      options: [...BUTTON_VARIANTS],
                      admin: { width: "25%" },
                    },
                  ],
                },
                {
                  name: "isButton",
                  type: "checkbox",
                  label: "Render as button",
                  defaultValue: true,
                },
              ],
            },
          ],
        },
        {
          label: "Footer",
          fields: [
            {
              name: "footerColumns",
              type: "array",
              label: "Footer columns",
              fields: [
                { name: "title", type: "text", required: true },
                {
                  name: "links",
                  type: "array",
                  fields: [
                    {
                      type: "row",
                      fields: [
                        {
                          name: "label",
                          type: "text",
                          required: true,
                          admin: { width: "50%" },
                        },
                        {
                          name: "url",
                          type: "text",
                          required: true,
                          admin: { width: "50%" },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              name: "footerPolicies",
              type: "array",
              label: "Bottom-bar policy links",
              fields: [
                {
                  type: "row",
                  fields: [
                    {
                      name: "label",
                      type: "text",
                      required: true,
                      admin: { width: "50%" },
                    },
                    {
                      name: "url",
                      type: "text",
                      required: true,
                      admin: { width: "50%" },
                    },
                  ],
                },
              ],
            },
            {
              name: "copyright",
              type: "text",
              admin: {
                description:
                  "Bottom-bar copyright. Defaults to © {year} {app name}.",
              },
            },
          ],
        },
        {
          label: "Social",
          fields: [
            {
              name: "social",
              type: "group",
              label: false,
              fields: [
                { name: "twitter", type: "text" },
                { name: "github", type: "text" },
                { name: "instagram", type: "text" },
                { name: "facebook", type: "text" },
                { name: "youtube", type: "text" },
                { name: "linkedin", type: "text" },
              ],
            },
          ],
        },
      ],
    },
  ],
};
