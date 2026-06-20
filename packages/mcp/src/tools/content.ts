import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Where } from "payload";
import { z } from "zod";

import type { McpToolContext } from "../payload-context";
import {
  createDoc,
  deleteDoc,
  findDoc,
  findDocs,
  updateDoc,
} from "../payload-context";
import { COLLECTION_SLUGS, docTitle, getCollectionInfo } from "./registry";
import { errorResult, jsonResult, runTool } from "./shared";

/**
 * The generic CMS content tools: search / read / create / update / delete
 * across the allowlisted collections. Every call runs through the Payload Local
 * API as the staff user (access enforced), so e.g. an author who lacks create
 * access on a collection simply gets a permission error back.
 */
export function registerContentTools(
  server: McpServer,
  ctx: McpToolContext,
): void {
  const collection = z
    .enum(COLLECTION_SLUGS)
    .describe("The CMS collection slug (see list_collections).");

  server.registerTool(
    "search_content",
    {
      title: "Search content",
      description:
        "Search a CMS collection. Optional free-text `query` matches the " +
        "collection's title/text fields; results are paginated. Use " +
        "list_collections to see available collections.",
      inputSchema: {
        collection,
        query: z.string().optional().describe("Free-text search (optional)."),
        limit: z.number().int().min(1).max(100).optional(),
        page: z.number().int().min(1).optional(),
      },
    },
    ({ collection: slug, query, limit, page }) =>
      runTool(async () => {
        const info = getCollectionInfo(slug);
        if (!info) return errorResult(`Unknown collection: ${slug}`);

        let where: Where | undefined;
        if (query?.trim()) {
          where = {
            or: info.searchFields.map((field) => ({
              [field]: { like: query },
            })),
          };
        }

        const res = await findDocs(ctx, slug, { where, limit, page });
        return jsonResult({
          collection: slug,
          total: res.totalDocs,
          page: res.page,
          totalPages: res.totalPages,
          results: res.docs.map((doc) => ({
            id: doc.id,
            title: docTitle(info, doc),
            status: doc._status ?? doc.status ?? null,
            updatedAt: doc.updatedAt ?? null,
          })),
        });
      }),
  );

  server.registerTool(
    "read_content",
    {
      title: "Read content",
      description:
        "Fetch a single document by collection + id, with relationships " +
        "populated one level deep.",
      inputSchema: { collection, id: z.string() },
    },
    ({ collection: slug, id }) =>
      runTool(async () => {
        const doc = await findDoc(ctx, slug, id);
        if (!doc) return errorResult(`Not found: ${slug}/${id}`);
        return jsonResult(doc);
      }),
  );

  server.registerTool(
    "create_content",
    {
      title: "Create content",
      description:
        "Create a document in a collection. `data` is the collection's fields " +
        "as JSON; Payload validates it and rejects fields you can't set. For " +
        "image-enabled collections (posts, pages, videos, audio, events, series, " +
        "locations) set `imagePrompt` (+ optional `imageAlt`) and the doc's " +
        "hero/OG images are generated and attached automatically on save — no " +
        "need to call generate_media or upload anything.",
      inputSchema: {
        collection,
        data: z.record(z.string(), z.unknown()).describe("Field values."),
      },
    },
    ({ collection: slug, data }) =>
      runTool(async () => {
        const doc = await createDoc(ctx, slug, data);
        return jsonResult({ created: true, id: doc.id, doc });
      }),
  );

  server.registerTool(
    "update_content",
    {
      title: "Update content",
      description:
        "Update a document by id. `data` contains only the fields to change. " +
        "Setting `imagePrompt` on an image-enabled collection regenerates any " +
        "empty image slots on save (clear a slot to regenerate just that one).",
      inputSchema: {
        collection,
        id: z.string(),
        data: z.record(z.string(), z.unknown()).describe("Fields to change."),
      },
    },
    ({ collection: slug, id, data }) =>
      runTool(async () => {
        const doc = await updateDoc(ctx, slug, id, data);
        return jsonResult({ updated: true, id: doc.id, doc });
      }),
  );

  server.registerTool(
    "delete_content",
    {
      title: "Delete content",
      description:
        "Delete a document by id. Soft-deletes (moves to Trash) for collections " +
        "with trash enabled; hard-deletes otherwise.",
      inputSchema: { collection, id: z.string() },
    },
    ({ collection: slug, id }) =>
      runTool(async () => {
        const doc = await deleteDoc(ctx, slug, id);
        return jsonResult({ deleted: true, id: doc.id });
      }),
  );
}
