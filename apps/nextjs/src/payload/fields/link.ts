import type { Field } from "payload";

/**
 * A reusable, optional link group supporting both internal and external links.
 *
 * - `type` — "internal" (a path on this site) or "external" (another origin).
 * - `url`  — the path (e.g. `/pricing`) or full URL (e.g. `https://example.com`).
 * - `newTab` — open in a new tab (`target="_blank"` + safe `rel`).
 *
 * Resolve the stored value with `resolveLink()` in `lib/payload.ts`, which
 * normalizes a missing url to a sensible fallback.
 */
export const linkField = (
  name = "link",
  options: { label?: string; description?: string } = {},
): Field => ({
  name,
  type: "group",
  label: options.label ?? "Link",
  admin: {
    description:
      options.description ??
      "Optional link. Internal points to a path on this site; external to another URL.",
  },
  fields: [
    {
      type: "row",
      fields: [
        {
          name: "type",
          type: "radio",
          defaultValue: "internal",
          options: [
            { label: "Internal", value: "internal" },
            { label: "External", value: "external" },
          ],
          admin: { layout: "horizontal", width: "50%" },
        },
        {
          name: "newTab",
          type: "checkbox",
          label: "Open in new tab",
          defaultValue: false,
          admin: { width: "50%" },
        },
      ],
    },
    {
      name: "url",
      type: "text",
      admin: {
        description:
          "Internal path (e.g. /pricing) or full external URL (https://example.com).",
      },
    },
  ],
});
