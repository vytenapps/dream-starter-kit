import type { Field } from "payload";

/**
 * A reusable, optional link group.
 *
 * - `url` — an internal path (e.g. `/pricing`) or a full external URL
 *   (e.g. `https://example.com`). Internal vs. external is auto-detected from
 *   the value by `resolveLink()` — no manual toggle.
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
    description: options.description ?? "Optional link.",
  },
  fields: [
    {
      name: "url",
      type: "text",
      label: "URL",
      admin: {
        description:
          "Internal path (e.g. /pricing) or full external URL (https://example.com).",
      },
    },
    {
      name: "newTab",
      type: "checkbox",
      label: "Open in new tab",
      defaultValue: false,
    },
  ],
});
