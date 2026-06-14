import "server-only";

/**
 * `@acme/mcp` — the kit's remote Model Context Protocol (MCP) server.
 *
 * A workspace admin connects an MCP client (Claude, ChatGPT, Cursor, …) to the
 * web app and manages Payload CMS content + push notifications in natural
 * language. Auth is OAuth 2.1 (browser login that reuses the app's existing
 * Supabase sign-in), and every tool runs through the Payload Local API AS the
 * authenticated staff user, so Payload's role-based access control is enforced.
 *
 * This is a SERVER-ONLY package (`import "server-only"` above): it pulls in
 * Payload, `jose`, and the service-role Supabase client and must never enter a
 * client/Metro bundle. Thin Next.js route handlers in `apps/nextjs` wire it in;
 * Payload + the service-role client are injected so the package stays
 * framework-agnostic and unit-testable. Pure submodules (`./auth/*`,
 * `./tools/*`, `./dispatch/*`) avoid the `server-only` import so they can be
 * unit-tested directly under vitest.
 *
 * The concrete server, tool, and dispatch exports are added in the following
 * phases.
 */
export const MCP_PACKAGE = "@acme/mcp" as const;

// --- OAuth 2.1 authorization server -------------------------------------------
export {
  authorizationServerMetadata,
  issuerIdentifier,
  MCP_SCOPE,
  protectedResourceMetadata,
  resourceIdentifier,
} from "./auth/oauth-metadata";
export {
  handleClientRegistration,
  handleTokenRequest,
  issueAuthorizationCode,
  OAuthError,
  OAuthRedirectError,
  validateAuthorizeRequest,
} from "./auth/oauth-server";
export type {
  McpOAuthConfig,
  ValidatedAuthorizeRequest,
} from "./auth/oauth-server";
export { verifyAccessToken } from "./auth/tokens";
export type { McpOAuthDatabase, McpStoreClient } from "./auth/store";

// --- MCP server + tools -------------------------------------------------------
export { buildMcpServer, handleMcpRequest } from "./server";
export { resolveStaffPayloadUser } from "./payload-context";
export type { McpToolContext } from "./payload-context";
export { MCP_COLLECTIONS } from "./tools/registry";
