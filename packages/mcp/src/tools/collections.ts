import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { McpToolContext } from "../payload-context";
import { MCP_COLLECTIONS } from "./registry";
import { jsonResult, runTool } from "./shared";

/**
 * Discovery tool: lists the collections the MCP can operate on, grouped, plus
 * the caller's roles so the model knows what it can likely do. Actual authz is
 * enforced per-operation by Payload.
 */
export function registerCollectionTools(
  server: McpServer,
  ctx: McpToolContext,
): void {
  server.registerTool(
    "list_collections",
    {
      title: "List collections",
      description:
        "List the CMS collections available to search/read/write, with their " +
        "admin group. Call this first to discover valid `collection` slugs.",
      inputSchema: {},
    },
    () =>
      runTool(() => {
        const roles = (ctx.user as { roles?: string[] }).roles ?? [];
        return Promise.resolve(
          jsonResult({
            roles,
            collections: MCP_COLLECTIONS.map((c) => ({
              slug: c.slug,
              label: c.label,
              group: c.group,
              titleField: c.titleField,
            })),
          }),
        );
      }),
  );
}
