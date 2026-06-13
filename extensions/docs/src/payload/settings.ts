import { defineExtensionSettings } from "@acme/ext-kit/payload";

import { syncDocsAfterChange } from "./hooks/sync-docs";

/**
 * Docs settings — points the GitHub sync at a public repo's docs folder.
 * Ticking `syncNow` runs the sync via an afterChange hook (billing's
 * sync-plan-to-stripe pattern) and unticks itself; results land on
 * syncStatus/syncError instead of failing the save.
 */
export const settings = defineExtensionSettings({
  slug: "docs",
  name: "Docs",
  fields: [
    {
      type: "row",
      fields: [
        {
          name: "githubRepo",
          type: "text",
          admin: {
            width: "60%",
            description: "Public repo as owner/name (e.g. vercel/next.js).",
          },
        },
        {
          name: "githubBranch",
          type: "text",
          defaultValue: "main",
          admin: { width: "40%" },
        },
      ],
    },
    {
      name: "githubPath",
      type: "text",
      defaultValue: "docs",
      admin: { description: "Folder within the repo to sync (*.md/*.mdx)." },
    },
    {
      name: "syncNow",
      type: "checkbox",
      defaultValue: false,
      label: "Sync now",
      admin: {
        description:
          "Save with this checked to pull the latest docs from GitHub.",
      },
    },
    {
      name: "syncStatus",
      type: "text",
      admin: { readOnly: true, description: "Result of the last sync." },
    },
    {
      name: "syncError",
      type: "textarea",
      admin: { readOnly: true },
    },
  ],
});

export interface DocsSettings extends Record<string, unknown> {
  githubRepo?: string | null;
  githubBranch: string;
  githubPath: string;
  syncNow?: boolean | null;
  syncStatus?: string | null;
  syncError?: string | null;
}

// Attach the sync hook to the generated global.
settings.global.hooks = {
  ...(settings.global.hooks ?? {}),
  afterChange: [
    ...(settings.global.hooks?.afterChange ?? []),
    syncDocsAfterChange,
  ],
};
