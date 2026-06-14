/* eslint-disable @typescript-eslint/consistent-type-definitions --
 * The row/schema types below MUST be `type` aliases, not `interface`s:
 * supabase-js's `GenericTable`/`GenericSchema` constraint requires
 * Row/Insert/Update to be assignable to `Record<string, unknown>`, which
 * interfaces are not (they can be augmented). Using `interface` collapses the
 * `.from()` builder types to `never`. */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AUTHORIZATION_CODE_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from "./tokens";

/**
 * Persistence for the MCP OAuth server: registered clients, single-use
 * authorization codes, and rotating refresh tokens. Backed by the three
 * server-only `public.mcp_oauth_*` tables (deny-all RLS — reached only via the
 * injected service-role client).
 *
 * To stay decoupled from the app's generated `Database` type (and runnable
 * before `db:gen-types`), this module declares a MINIMAL typed schema for just
 * those three tables and the route layer casts the service-role client to
 * `McpStoreClient` once at the boundary.
 */

// NOTE: these are `type` aliases, not `interface`s, on purpose — supabase-js's
// `GenericTable` constraint requires Row/Insert/Update to be assignable to
// `Record<string, unknown>`, which interfaces are NOT (they can be augmented).
// Using `type` keeps the minimal schema below satisfying `GenericSchema`.
export type OAuthClientRow = {
  id: string;
  client_secret_hash: string | null;
  client_name: string | null;
  redirect_uris: string[];
  grant_types: string[];
  token_endpoint_auth_method: string;
  scope: string | null;
  created_at: string;
};

export type AuthorizationCodeRow = {
  code: string;
  client_id: string;
  supabase_user_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  scope: string | null;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

export type RefreshTokenRow = {
  token_hash: string;
  client_id: string;
  supabase_user_id: string;
  scope: string | null;
  expires_at: string;
  rotated_to: string | null;
  revoked_at: string | null;
  created_at: string;
};

type Table<Row, Insert> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: [];
};

export type McpOAuthDatabase = {
  public: {
    Tables: {
      mcp_oauth_clients: Table<
        OAuthClientRow,
        Omit<OAuthClientRow, "created_at"> & { created_at?: string }
      >;
      mcp_authorization_codes: Table<
        AuthorizationCodeRow,
        Omit<AuthorizationCodeRow, "consumed_at" | "created_at"> & {
          consumed_at?: string | null;
          created_at?: string;
        }
      >;
      mcp_refresh_tokens: Table<
        RefreshTokenRow,
        Omit<RefreshTokenRow, "rotated_to" | "revoked_at" | "created_at"> & {
          rotated_to?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type McpStoreClient = SupabaseClient<McpOAuthDatabase, "public">;

const isoIn = (seconds: number) =>
  new Date(Date.now() + seconds * 1000).toISOString();

// --- Clients (Dynamic Client Registration) ------------------------------------

export async function registerClient(
  db: McpStoreClient,
  input: {
    id: string;
    clientName?: string;
    redirectUris: string[];
    grantTypes?: string[];
    tokenEndpointAuthMethod?: string;
    clientSecretHash?: string | null;
    scope?: string | null;
  },
): Promise<OAuthClientRow> {
  const { data, error } = await db
    .from("mcp_oauth_clients")
    .insert({
      id: input.id,
      client_name: input.clientName ?? null,
      redirect_uris: input.redirectUris,
      grant_types: input.grantTypes ?? ["authorization_code", "refresh_token"],
      token_endpoint_auth_method: input.tokenEndpointAuthMethod ?? "none",
      client_secret_hash: input.clientSecretHash ?? null,
      scope: input.scope ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`registerClient failed: ${error.message}`);
  return data;
}

export async function getClient(
  db: McpStoreClient,
  clientId: string,
): Promise<OAuthClientRow | null> {
  const { data } = await db
    .from("mcp_oauth_clients")
    .select()
    .eq("id", clientId)
    .maybeSingle();
  return data ?? null;
}

// --- Authorization codes (single-use, PKCE) -----------------------------------

export async function saveAuthorizationCode(
  db: McpStoreClient,
  input: {
    code: string;
    clientId: string;
    supabaseUserId: string;
    redirectUri: string;
    codeChallenge: string;
    scope?: string | null;
    ttlSeconds?: number;
  },
): Promise<void> {
  const { error } = await db.from("mcp_authorization_codes").insert({
    code: input.code,
    client_id: input.clientId,
    supabase_user_id: input.supabaseUserId,
    redirect_uri: input.redirectUri,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    scope: input.scope ?? null,
    expires_at: isoIn(input.ttlSeconds ?? AUTHORIZATION_CODE_TTL_SECONDS),
  });
  if (error) throw new Error(`saveAuthorizationCode failed: ${error.message}`);
}

/**
 * Atomically consume an authorization code: marks it consumed and returns the
 * row only if it was still unconsumed AND unexpired. Returns null otherwise
 * (already used, expired, or unknown) — the caller treats null as invalid_grant.
 */
export async function consumeAuthorizationCode(
  db: McpStoreClient,
  code: string,
): Promise<AuthorizationCodeRow | null> {
  const { data } = await db
    .from("mcp_authorization_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("code", code)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .select()
    .maybeSingle();
  return data ?? null;
}

// --- Refresh tokens (rotating, hashed) ----------------------------------------

export async function saveRefreshToken(
  db: McpStoreClient,
  input: {
    tokenHash: string;
    clientId: string;
    supabaseUserId: string;
    scope?: string | null;
    ttlSeconds?: number;
  },
): Promise<void> {
  const { error } = await db.from("mcp_refresh_tokens").insert({
    token_hash: input.tokenHash,
    client_id: input.clientId,
    supabase_user_id: input.supabaseUserId,
    scope: input.scope ?? null,
    expires_at: isoIn(input.ttlSeconds ?? REFRESH_TOKEN_TTL_SECONDS),
  });
  if (error) throw new Error(`saveRefreshToken failed: ${error.message}`);
}

export async function getRefreshToken(
  db: McpStoreClient,
  tokenHash: string,
): Promise<RefreshTokenRow | null> {
  const { data } = await db
    .from("mcp_refresh_tokens")
    .select()
    .eq("token_hash", tokenHash)
    .maybeSingle();
  return data ?? null;
}

/** Mark a refresh token rotated to a successor (revokes the old one). */
export async function markRefreshTokenRotated(
  db: McpStoreClient,
  oldHash: string,
  newHash: string,
): Promise<void> {
  const { error } = await db
    .from("mcp_refresh_tokens")
    .update({ rotated_to: newHash, revoked_at: new Date().toISOString() })
    .eq("token_hash", oldHash);
  if (error) throw new Error(`markRefreshTokenRotated failed: ${error.message}`);
}

/**
 * Reuse detection: a presented refresh token that was already rotated/revoked
 * means the chain is compromised — revoke every refresh token for that
 * user+client so the attacker and victim are both forced to re-authenticate.
 */
export async function revokeRefreshTokensForUserClient(
  db: McpStoreClient,
  supabaseUserId: string,
  clientId: string,
): Promise<void> {
  await db
    .from("mcp_refresh_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("supabase_user_id", supabaseUserId)
    .eq("client_id", clientId)
    .is("revoked_at", null);
}
