import type { ExtDocsPage } from "@acme/cms";
import type { ExtSeedStep } from "@acme/ext-kit/payload";

type DocBody = ExtDocsPage["body"];

/**
 * Starter developer docs so /docs (sidebar, TOC, search, Ask-AI) works out of
 * the box. Runs through the host's idempotent CMS seed flow. Bodies are simple
 * Lexical roots (heading + paragraphs) so the seed stays scalar-only.
 */
const para = (text: string) => ({
  type: "paragraph",
  version: 1,
  children: [{ type: "text", version: 1, text }],
});
const heading = (text: string, tag: "h2" | "h3" = "h2") => ({
  type: "heading",
  tag,
  version: 1,
  children: [{ type: "text", version: 1, text }],
});
const body = (nodes: unknown[]): DocBody =>
  ({
    root: {
      type: "root",
      version: 1,
      direction: null,
      format: "",
      indent: 0,
      children: nodes,
    },
  }) as unknown as DocBody;

export const seed: ExtSeedStep[] = [
  {
    label: "Docs pages",
    run: async (payload) => {
      const pages = [
        {
          title: "Introduction",
          slug: "introduction",
          category: "Getting Started",
          order: 1,
          excerpt: "What this kit is and how the docs site works.",
          body: body([
            heading("Welcome"),
            para(
              "These developer docs are powered by the ext-docs extension. " +
                "Pages can be authored here in the CMS or synced from a public " +
                "GitHub repo's docs folder.",
            ),
            heading("Ask AI", "h3"),
            para(
              "Use the Ask AI panel (top bar) to ask questions — answers are " +
                "grounded in these docs with links to the sources.",
            ),
          ]),
        },
        {
          title: "Installation",
          slug: "installation",
          category: "Getting Started",
          order: 2,
          excerpt: "Clone, install, and run the kit locally.",
          body: body([
            heading("Install"),
            para("Run pnpm install, then supabase start, then pnpm dev."),
          ]),
        },
        {
          title: "Extensions",
          slug: "extensions",
          category: "Guides",
          order: 1,
          excerpt: "How features ship as vendored extension packages.",
          body: body([
            heading("Extensions"),
            para(
              "Features are extensions under extensions/<slug>. Use pnpm ext " +
                "create to scaffold one, and pnpm ext sync after changes.",
            ),
          ]),
        },
        {
          title: "GitHub Sync",
          slug: "github-sync",
          category: "Guides",
          order: 2,
          excerpt: "Pull docs from a GitHub repo into the CMS.",
          body: body([
            heading("Syncing docs from GitHub"),
            para(
              "In /admin → Docs Settings, set a public owner/name repo, branch, " +
                "and folder, then tick Sync now and save.",
            ),
          ]),
        },
      ];

      for (const page of pages) {
        await payload.create({
          collection: "ext-docs-pages",
          data: {
            ...page,
            source: "manual",
            _status: "published",
          },
        });
      }
    },
  },
];
