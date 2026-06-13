import type { CollectionConfig } from "payload";

import { isStaff, publishedOrStaff } from "@acme/ext-kit/payload";

import { slugField } from "../fields/slug";

/**
 * Docs pages — the public developer-docs content. Authored in /admin or synced
 * from a GitHub repo (the read-only Source group records provenance so re-sync
 * is idempotent and never clobbers manually-authored pages). Drafts/publish:
 * the public site renders published pages; staff preview drafts.
 */
export const Pages: CollectionConfig = {
  slug: "ext-docs-pages",
  labels: { singular: "Documentation Page", plural: "Documentation" },
  admin: {
    useAsTitle: "title",
    group: "Content",
    defaultColumns: ["title", "category", "order", "source", "_status"],
    listSearchableFields: ["title", "excerpt"],
  },
  versions: { drafts: true },
  access: {
    read: publishedOrStaff,
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  fields: [
    { name: "title", type: "text", required: true },
    slugField("title"),
    {
      name: "excerpt",
      type: "textarea",
      admin: { description: "Short summary — used in search + meta." },
    },
    { name: "body", type: "richText" },
    {
      type: "row",
      fields: [
        {
          name: "category",
          type: "text",
          admin: {
            width: "60%",
            description: "Sidebar grouping (e.g. 'Getting Started').",
          },
        },
        {
          name: "order",
          type: "number",
          defaultValue: 0,
          admin: { width: "40%", description: "Sort order within category." },
        },
      ],
    },
    {
      type: "collapsible",
      label: "Source",
      admin: {
        description:
          "Provenance for GitHub-synced pages. Leave as 'manual' for pages " +
          "authored here — the sync never touches them.",
      },
      fields: [
        {
          name: "source",
          type: "select",
          defaultValue: "manual",
          options: [
            { label: "Manual", value: "manual" },
            { label: "GitHub", value: "github" },
          ],
          admin: { readOnly: true },
        },
        {
          name: "sourcePath",
          type: "text",
          admin: { readOnly: true, description: "Repo-relative file path." },
        },
        {
          name: "sourceSha",
          type: "text",
          admin: { readOnly: true, description: "Blob SHA (idempotent sync)." },
        },
      ],
    },
  ],
};
