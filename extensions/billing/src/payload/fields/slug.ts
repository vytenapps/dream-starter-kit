import type { Field } from "payload";

const slugify = (val: string): string =>
  val
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * A URL slug field that auto-derives from another field (default `title`) when
 * left blank, then stays editable. Unique + indexed for fast `where[slug]` reads.
 */
export const slugField = (from = "title"): Field => ({
  name: "slug",
  type: "text",
  required: true,
  unique: true,
  index: true,
  admin: { position: "sidebar" },
  hooks: {
    beforeValidate: [
      ({ value, data }) => {
        if (typeof value === "string" && value.length > 0)
          return slugify(value);
        const source: unknown = data?.[from];
        if (typeof source === "string" && source.length > 0)
          return slugify(source);
        return typeof value === "string" ? value : undefined;
      },
    ],
  },
});
