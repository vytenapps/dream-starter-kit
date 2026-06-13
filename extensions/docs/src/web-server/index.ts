/**
 * Server-rendered web entry (RSC pages using the Payload Local API) — kept
 * separate from ./web so the client islands never pull payload/node modules
 * into client chunks.
 */
export { DocsIndexPage } from "./docs-index-page";
export { DocsDetailPage } from "./docs-detail-page";
