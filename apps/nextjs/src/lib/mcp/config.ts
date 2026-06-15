import "server-only";

import type { McpOAuthConfig, McpStoreClient } from "@acme/mcp";

import { env } from "~/env";
import { getSiteUrl } from "~/lib/site-url";
import { createAdminClient } from "~/lib/supabase/admin";

/**
 * App-side glue for the remote MCP server (@acme/mcp). The package is
 * framework-agnostic; here we resolve its config from the validated env + the
 * canonical site origin, and hand it the service-role client for the
 * server-only `mcp_oauth_*` tables.
 */

/** MCP is OFF until a signing secret is set (and not explicitly disabled). */
export function isMcpEnabled(): boolean {
  return Boolean(env.MCP_JWT_SECRET) && env.MCP_ENABLED !== "off";
}

export function getMcpOAuthConfig(): McpOAuthConfig {
  if (!env.MCP_JWT_SECRET) {
    throw new Error("MCP_JWT_SECRET is not set — the MCP server is disabled.");
  }
  return { origin: getSiteUrl(), jwtSecret: env.MCP_JWT_SECRET };
}

/**
 * Service-role client for the OAuth tables, cast to the package's minimal typed
 * schema. The tables enforce deny-all RLS, so only this (BYPASSRLS) client
 * reaches them.
 */
export function getMcpStoreClient(): McpStoreClient {
  return createAdminClient() as unknown as McpStoreClient;
}
