import type { McpStoreClient, OAuthClientRow } from "./store";
import {
  issuerIdentifier,
  MCP_SCOPE,
  resourceIdentifier,
} from "./oauth-metadata";
import { isSupportedChallengeMethod, verifyPkceS256 } from "./pkce";
import {
  consumeAuthorizationCode,
  getClient,
  getRefreshToken,
  markRefreshTokenRotated,
  registerClient,
  revokeRefreshTokensForUserClient,
  saveAuthorizationCode,
  saveRefreshToken,
} from "./store";
import {
  generateClientId,
  generateOpaqueToken,
  hashToken,
  mintAccessToken,
} from "./tokens";

/**
 * Framework-agnostic OAuth 2.1 flow logic for the MCP authorization server.
 * The Next.js route handlers parse the request, read the Supabase session, and
 * build the HTTP response; everything else — validation, PKCE, token minting,
 * refresh rotation/reuse detection — lives here so it is testable in isolation.
 */

export interface McpOAuthConfig {
  /** Public app origin, e.g. https://app.example.com (no trailing slash). */
  origin: string;
  /** HMAC secret for signing access-token JWTs (MCP_JWT_SECRET). */
  jwtSecret: string;
}

/** An OAuth error that maps to an RFC 6749 error response. */
export class OAuthError extends Error {
  constructor(
    readonly error: string,
    readonly description: string,
    readonly status = 400,
  ) {
    super(`${error}: ${description}`);
    this.name = "OAuthError";
  }
}

const isLoopback = (u: URL) =>
  u.hostname === "localhost" ||
  u.hostname === "127.0.0.1" ||
  u.hostname === "::1";

/** A redirect URI must be a valid absolute https URL (or http on loopback). */
function isValidRedirectUri(uri: string): boolean {
  try {
    const u = new URL(uri);
    return u.protocol === "https:" || (u.protocol === "http:" && isLoopback(u));
  } catch {
    return false;
  }
}

// --- Dynamic Client Registration (RFC 7591) -----------------------------------

export interface ClientRegistrationResponse {
  client_id: string;
  client_id_issued_at: number;
  redirect_uris: string[];
  grant_types: string[];
  token_endpoint_auth_method: string;
  client_name?: string;
  scope: string;
}

export async function handleClientRegistration(
  store: McpStoreClient,
  body: unknown,
): Promise<ClientRegistrationResponse> {
  const b = (body ?? {}) as Record<string, unknown>;
  const redirectUris = b.redirect_uris;
  if (
    !Array.isArray(redirectUris) ||
    redirectUris.length === 0 ||
    !redirectUris.every((u): u is string => typeof u === "string")
  ) {
    throw new OAuthError(
      "invalid_redirect_uri",
      "redirect_uris is required and must be a non-empty array of strings",
    );
  }
  for (const uri of redirectUris) {
    if (!isValidRedirectUri(uri)) {
      throw new OAuthError(
        "invalid_redirect_uri",
        `redirect_uri is not an allowed URL: ${uri}`,
      );
    }
  }

  const clientName =
    typeof b.client_name === "string" ? b.client_name : undefined;
  const created = await registerClient(store, {
    id: generateClientId(),
    clientName,
    redirectUris,
    grantTypes: ["authorization_code", "refresh_token"],
    tokenEndpointAuthMethod: "none",
    scope: MCP_SCOPE,
  });

  return {
    client_id: created.id,
    client_id_issued_at: Math.floor(Date.parse(created.created_at) / 1000),
    redirect_uris: created.redirect_uris,
    grant_types: created.grant_types,
    token_endpoint_auth_method: created.token_endpoint_auth_method,
    client_name: created.client_name ?? undefined,
    scope: created.scope ?? MCP_SCOPE,
  };
}

// --- Authorization endpoint ---------------------------------------------------

export interface ValidatedAuthorizeRequest {
  client: OAuthClientRow;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  state: string | null;
}

/**
 * Validate the /authorize query. Throws OAuthError for client/redirect_uri
 * problems (which must NOT redirect — the client is untrusted). Param problems
 * that are safe to report to a validated redirect_uri are returned via
 * `authorizeErrorRedirect`.
 */
export async function validateAuthorizeRequest(
  store: McpStoreClient,
  params: URLSearchParams,
): Promise<ValidatedAuthorizeRequest> {
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  if (!clientId)
    throw new OAuthError("invalid_request", "client_id is required");
  if (!redirectUri)
    throw new OAuthError("invalid_request", "redirect_uri is required");

  const client = await getClient(store, clientId);
  if (!client) throw new OAuthError("invalid_client", "Unknown client_id");
  if (!client.redirect_uris.includes(redirectUri)) {
    throw new OAuthError(
      "invalid_request",
      "redirect_uri does not match a registered URI",
    );
  }

  // From here, errors are safe to redirect back to redirect_uri.
  const responseType = params.get("response_type");
  if (responseType !== "code") {
    throw new OAuthRedirectError(
      redirectUri,
      "unsupported_response_type",
      "Only response_type=code is supported",
      params.get("state"),
    );
  }
  const challenge = params.get("code_challenge");
  if (!challenge) {
    throw new OAuthRedirectError(
      redirectUri,
      "invalid_request",
      "code_challenge is required (PKCE)",
      params.get("state"),
    );
  }
  if (
    !isSupportedChallengeMethod(
      params.get("code_challenge_method") ?? undefined,
    )
  ) {
    throw new OAuthRedirectError(
      redirectUri,
      "invalid_request",
      "code_challenge_method must be S256",
      params.get("state"),
    );
  }

  return {
    client,
    redirectUri,
    codeChallenge: challenge,
    scope: params.get("scope") ?? MCP_SCOPE,
    state: params.get("state"),
  };
}

/** An OAuth error that is safe to report by redirecting to the client. */
export class OAuthRedirectError extends Error {
  constructor(
    readonly redirectUri: string,
    readonly error: string,
    readonly description: string,
    readonly state: string | null,
  ) {
    super(`${error}: ${description}`);
    this.name = "OAuthRedirectError";
  }

  toRedirectUrl(): string {
    const u = new URL(this.redirectUri);
    u.searchParams.set("error", this.error);
    u.searchParams.set("error_description", this.description);
    if (this.state) u.searchParams.set("state", this.state);
    return u.toString();
  }
}

/** Issue an authorization code for an authenticated staff user and build the redirect. */
export async function issueAuthorizationCode(
  store: McpStoreClient,
  req: ValidatedAuthorizeRequest,
  supabaseUserId: string,
): Promise<string> {
  const code = generateOpaqueToken();
  await saveAuthorizationCode(store, {
    code,
    clientId: req.client.id,
    supabaseUserId,
    redirectUri: req.redirectUri,
    codeChallenge: req.codeChallenge,
    scope: req.scope,
  });
  const u = new URL(req.redirectUri);
  u.searchParams.set("code", code);
  if (req.state) u.searchParams.set("state", req.state);
  return u.toString();
}

// --- Token endpoint -----------------------------------------------------------

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export async function handleTokenRequest(
  store: McpStoreClient,
  config: McpOAuthConfig,
  form: URLSearchParams,
): Promise<TokenResponse> {
  const grantType = form.get("grant_type");
  if (grantType === "authorization_code") {
    return authorizationCodeGrant(store, config, form);
  }
  if (grantType === "refresh_token") {
    return refreshTokenGrant(store, config, form);
  }
  throw new OAuthError(
    "unsupported_grant_type",
    "grant_type must be authorization_code or refresh_token",
  );
}

async function mintPair(
  store: McpStoreClient,
  config: McpOAuthConfig,
  args: { subject: string; clientId: string; scope: string },
): Promise<TokenResponse> {
  const { token, expiresIn } = await mintAccessToken({
    secret: config.jwtSecret,
    issuer: issuerIdentifier(config.origin),
    audience: resourceIdentifier(config.origin),
    subject: args.subject,
    clientId: args.clientId,
    scope: args.scope,
  });
  const refreshToken = generateOpaqueToken();
  await saveRefreshToken(store, {
    tokenHash: hashToken(refreshToken),
    clientId: args.clientId,
    supabaseUserId: args.subject,
    scope: args.scope,
  });
  return {
    access_token: token,
    token_type: "Bearer",
    expires_in: expiresIn,
    refresh_token: refreshToken,
    scope: args.scope,
  };
}

async function authorizationCodeGrant(
  store: McpStoreClient,
  config: McpOAuthConfig,
  form: URLSearchParams,
): Promise<TokenResponse> {
  const code = form.get("code");
  const clientId = form.get("client_id");
  const redirectUri = form.get("redirect_uri");
  const verifier = form.get("code_verifier");
  if (!code || !clientId || !redirectUri || !verifier) {
    throw new OAuthError(
      "invalid_request",
      "code, client_id, redirect_uri, and code_verifier are required",
    );
  }

  const row = await consumeAuthorizationCode(store, code);
  if (!row)
    throw new OAuthError(
      "invalid_grant",
      "Authorization code is invalid or expired",
    );
  if (row.client_id !== clientId)
    throw new OAuthError("invalid_grant", "client_id does not match the code");
  if (row.redirect_uri !== redirectUri)
    throw new OAuthError(
      "invalid_grant",
      "redirect_uri does not match the code",
    );
  if (!verifyPkceS256(verifier, row.code_challenge))
    throw new OAuthError("invalid_grant", "PKCE verification failed");

  return mintPair(store, config, {
    subject: row.supabase_user_id,
    clientId: row.client_id,
    scope: row.scope ?? MCP_SCOPE,
  });
}

async function refreshTokenGrant(
  store: McpStoreClient,
  config: McpOAuthConfig,
  form: URLSearchParams,
): Promise<TokenResponse> {
  const refreshToken = form.get("refresh_token");
  const clientId = form.get("client_id");
  if (!refreshToken || !clientId) {
    throw new OAuthError(
      "invalid_request",
      "refresh_token and client_id are required",
    );
  }
  const hash = hashToken(refreshToken);
  const row = await getRefreshToken(store, hash);
  if (!row) throw new OAuthError("invalid_grant", "Unknown refresh token");
  if (row.client_id !== clientId)
    throw new OAuthError("invalid_grant", "client_id does not match the token");

  // Reuse detection: a token already rotated or revoked means the chain is
  // compromised — revoke everything for this user+client and reject.
  if (row.rotated_to || row.revoked_at) {
    await revokeRefreshTokensForUserClient(
      store,
      row.supabase_user_id,
      row.client_id,
    );
    throw new OAuthError(
      "invalid_grant",
      "Refresh token has already been used",
    );
  }
  if (Date.parse(row.expires_at) <= Date.now())
    throw new OAuthError("invalid_grant", "Refresh token expired");

  const pair = await mintPair(store, config, {
    subject: row.supabase_user_id,
    clientId: row.client_id,
    scope: row.scope ?? MCP_SCOPE,
  });
  await markRefreshTokenRotated(store, hash, hashToken(pair.refresh_token));
  return pair;
}
