/**
 * OAuth 2.1 / MCP authorization discovery documents. Pure functions of the
 * app's public origin (e.g. https://app.example.com) — no I/O — so MCP clients
 * (Claude, ChatGPT, Cursor) can discover how to authenticate.
 *
 *   - Protected Resource Metadata (RFC 9728) advertises the resource (`/mcp`)
 *     and which authorization server protects it.
 *   - Authorization Server Metadata (RFC 8414) advertises the OAuth endpoints,
 *     PKCE support (S256 only), and dynamic client registration.
 */

/** The single scope this server issues. Fine-grained authz is Payload's job. */
export const MCP_SCOPE = "mcp";

const trimSlash = (origin: string) => origin.replace(/\/+$/, "");

export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  bearer_methods_supported: string[];
  scopes_supported: string[];
}

export function protectedResourceMetadata(
  origin: string,
): ProtectedResourceMetadata {
  const base = trimSlash(origin);
  return {
    resource: `${base}/mcp`,
    authorization_servers: [base],
    bearer_methods_supported: ["header"],
    scopes_supported: [MCP_SCOPE],
  };
}

export interface AuthorizationServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  scopes_supported: string[];
}

export function authorizationServerMetadata(
  origin: string,
): AuthorizationServerMetadata {
  const base = trimSlash(origin);
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    scopes_supported: [MCP_SCOPE],
  };
}

/** The `aud` of access tokens and the `resource` clients request. */
export function resourceIdentifier(origin: string): string {
  return `${trimSlash(origin)}/mcp`;
}

/** The token `iss` — the app origin (matches AS metadata `issuer`). */
export function issuerIdentifier(origin: string): string {
  return trimSlash(origin);
}
