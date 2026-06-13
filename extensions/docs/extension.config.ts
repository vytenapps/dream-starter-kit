import { defineExtension } from "@acme/ext-kit";

/**
 * Docs — a public developer-documentation site at /docs (cursor.com/docs-style
 * UX: sidebar nav + article + on-this-page TOC, ⌘K search, an "Ask AI" panel,
 * and "Explain more"). Content lives in the CMS (ext-docs-pages) and can be
 * authored in /admin or synced from a public GitHub repo's docs folder (the
 * ext-docs-settings global drives the sync). No Supabase tables — content is
 * Payload-governed; the /ask AI route is authed + rate-limited by the
 * dispatcher (golden rule #6), search is public.
 */
export default defineExtension({
  slug: "docs",
  name: "Docs",
  version: "1.0.0",
  kitCompat: ">=1.0.0 <2",
  description: "Public developer docs with GitHub sync + Ask-AI.",
  nav: {},
  routes: {
    web: [
      {
        path: "",
        component: "DocsIndexPage",
        area: "public",
        mount: "/docs",
        rsc: true,
      },
      {
        path: "[slug]",
        component: "DocsDetailPage",
        area: "public",
        mount: "/docs",
        rsc: true,
      },
    ],
  },
  server: {
    routes: true,
    publicRoutes: true,
  },
  cms: {
    collections: ["ext-docs-pages"],
    hasSettings: true,
    hasMigrations: true,
    hasSeed: true,
  },
});
