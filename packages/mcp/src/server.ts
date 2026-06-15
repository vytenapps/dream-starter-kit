import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import type { McpToolContext } from "./payload-context";
import { registerChatGptTools } from "./tools/chatgpt";
import { registerCollectionTools } from "./tools/collections";
import { registerContentTools } from "./tools/content";
import { registerNotificationTools } from "./tools/notifications";

const SERVER_INFO = { name: "dream-starter-kit", version: "1.0.0" };

const INSTRUCTIONS =
  "Manage this workspace's Payload CMS content and push notifications. " +
  "Call list_collections to discover collections, then search_content / " +
  "read_content / create_content / update_content / delete_content. Use " +
  "notify_schedule to schedule a push notification. `search` and `fetch` are " +
  "provided for ChatGPT-style retrieval. All actions run with your CMS " +
  "permissions.";

/** Build a fresh MCP server with every tool bound to this request's context. */
export function buildMcpServer(ctx: McpToolContext): McpServer {
  const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });
  registerCollectionTools(server, ctx);
  registerContentTools(server, ctx);
  registerChatGptTools(server, ctx);
  registerNotificationTools(server, ctx);
  return server;
}

/**
 * Handle one MCP HTTP request statelessly (no session store — ideal for
 * serverless). Uses the SDK's Web-standard transport so a Next.js Route
 * Handler's `Request` maps straight to a `Response`. `enableJsonResponse`
 * returns buffered JSON rather than holding an SSE stream open.
 */
export async function handleMcpRequest(
  request: Request,
  ctx: McpToolContext,
): Promise<Response> {
  const server = buildMcpServer(ctx);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}
