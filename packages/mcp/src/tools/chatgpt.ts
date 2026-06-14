import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Where } from "payload";
import { z } from "zod";

import type { McpToolContext } from "../payload-context";
import { findDoc, findDocs } from "../payload-context";
import { docTitle, getCollectionInfo, MCP_COLLECTIONS } from "./registry";
import { errorResult, jsonResult, runTool } from "./shared";

/**
 * ChatGPT-compatible `search` and `fetch` tools. ChatGPT connectors require a
 * `search` tool returning `{ results: [{ id, title, url }] }` and a `fetch`
 * tool returning a `{ id, title, text, url, metadata }` document. Ids are
 * encoded as `collection:id` so `fetch` can route back to the right collection.
 * Both also expose `structuredContent` for clients that prefer it.
 */
const SEARCHABLE = MCP_COLLECTIONS.filter((c) => c.chatgptSearch);

function urlFor(
  ctx: McpToolContext,
  slug: string,
  doc: Record<string, unknown>,
): string {
  const info = getCollectionInfo(slug);
  const path = info?.publicPath?.(doc);
  return path
    ? `${ctx.origin}${path}`
    : `${ctx.origin}/admin/collections/${slug}/${String(doc.id)}`;
}

/** Best-effort readable text from a doc's scalar fields. */
function docText(doc: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(doc)) {
    if (typeof value === "string" && value.trim() && key !== "id") {
      parts.push(`${key}: ${value}`);
    }
  }
  return parts.join("\n");
}

export function registerChatGptTools(
  server: McpServer,
  ctx: McpToolContext,
): void {
  server.registerTool(
    "search",
    {
      title: "Search",
      description:
        "Search published content across the site and return matching results " +
        "with ids and links. Use `fetch` to retrieve a full document by id.",
      inputSchema: { query: z.string().describe("The search query.") },
    },
    ({ query }) =>
      runTool(async () => {
        const perCollection = 5;
        const results: { id: string; title: string; url: string }[] = [];
        const trimmed = query.trim();

        for (const info of SEARCHABLE) {
          const where: Where | undefined = trimmed
            ? { or: info.searchFields.map((f) => ({ [f]: { like: query } })) }
            : undefined;
          const res = await findDocs(ctx, info.slug, {
            where,
            limit: perCollection,
          });
          for (const doc of res.docs) {
            results.push({
              id: `${info.slug}:${String(doc.id)}`,
              title: docTitle(info, doc),
              url: urlFor(ctx, info.slug, doc),
            });
          }
        }

        return jsonResult({ results }, { results });
      }),
  );

  server.registerTool(
    "fetch",
    {
      title: "Fetch",
      description:
        "Fetch a full document by the id returned from `search` " +
        "(format: `collection:id`).",
      inputSchema: {
        id: z.string().describe("A `collection:id` identifier from search."),
      },
    },
    ({ id }) =>
      runTool(async () => {
        const sep = id.indexOf(":");
        if (sep === -1) {
          return errorResult(
            "id must be in the form `collection:id` (from the search tool).",
          );
        }
        const slug = id.slice(0, sep);
        const docId = id.slice(sep + 1);
        const info = getCollectionInfo(slug);
        if (!info) return errorResult(`Unknown collection in id: ${slug}`);

        const doc = await findDoc(ctx, slug, docId);
        if (!doc) return errorResult(`Not found: ${id}`);

        const result = {
          id,
          title: docTitle(info, doc),
          text: docText(doc),
          url: urlFor(ctx, slug, doc),
          metadata: { collection: slug },
        };
        return jsonResult(result, result);
      }),
  );
}
