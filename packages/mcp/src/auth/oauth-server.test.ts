import { beforeEach, describe, expect, it, vi } from "vitest";

import { s256 } from "./pkce";
import type {
  AuthorizationCodeRow,
  McpStoreClient,
  OAuthClientRow,
  RefreshTokenRow,
} from "./store";
import { hashToken } from "./tokens";

/**
 * The OAuth flow logic is tested against an in-memory fake of the `./store`
 * module (mocked below), so we exercise the orchestration — PKCE enforcement,
 * client/redirect matching, refresh rotation + reuse detection — without a DB.
 */
const state = vi.hoisted(() => ({
  clients: new Map<string, OAuthClientRow>(),
  codes: new Map<string, AuthorizationCodeRow>(),
  refresh: new Map<string, RefreshTokenRow>(),
}));

vi.mock("./store", () => ({
  registerClient: vi.fn((_db: unknown, input: Record<string, unknown>) => {
    const row: OAuthClientRow = {
      id: input.id as string,
      client_secret_hash: null,
      client_name: (input.clientName as string | undefined) ?? null,
      redirect_uris: input.redirectUris as string[],
      grant_types: ["authorization_code", "refresh_token"],
      token_endpoint_auth_method: "none",
      scope: "mcp",
      created_at: new Date().toISOString(),
    };
    state.clients.set(row.id, row);
    return Promise.resolve(row);
  }),
  getClient: vi.fn((_db: unknown, id: string) =>
    Promise.resolve(state.clients.get(id) ?? null),
  ),
  saveAuthorizationCode: vi.fn((_db: unknown, input: Record<string, unknown>) => {
    state.codes.set(input.code as string, {
      code: input.code as string,
      client_id: input.clientId as string,
      supabase_user_id: input.supabaseUserId as string,
      redirect_uri: input.redirectUri as string,
      code_challenge: input.codeChallenge as string,
      code_challenge_method: "S256",
      scope: (input.scope as string | undefined) ?? null,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      consumed_at: null,
      created_at: new Date().toISOString(),
    });
    return Promise.resolve();
  }),
  consumeAuthorizationCode: vi.fn((_db: unknown, code: string) => {
    const row = state.codes.get(code);
    if (!row || row.consumed_at || Date.parse(row.expires_at) <= Date.now())
      return Promise.resolve(null);
    row.consumed_at = new Date().toISOString();
    return Promise.resolve(row);
  }),
  saveRefreshToken: vi.fn((_db: unknown, input: Record<string, unknown>) => {
    state.refresh.set(input.tokenHash as string, {
      token_hash: input.tokenHash as string,
      client_id: input.clientId as string,
      supabase_user_id: input.supabaseUserId as string,
      scope: (input.scope as string | undefined) ?? null,
      expires_at: new Date(Date.now() + 1_000_000).toISOString(),
      rotated_to: null,
      revoked_at: null,
      created_at: new Date().toISOString(),
    });
    return Promise.resolve();
  }),
  getRefreshToken: vi.fn((_db: unknown, hash: string) =>
    Promise.resolve(state.refresh.get(hash) ?? null),
  ),
  markRefreshTokenRotated: vi.fn(
    (_db: unknown, oldHash: string, newHash: string) => {
      const row = state.refresh.get(oldHash);
      if (row) {
        row.rotated_to = newHash;
        row.revoked_at = new Date().toISOString();
      }
      return Promise.resolve();
    },
  ),
  revokeRefreshTokensForUserClient: vi.fn(
    (_db: unknown, userId: string, clientId: string) => {
      for (const row of state.refresh.values()) {
        if (row.supabase_user_id === userId && row.client_id === clientId)
          row.revoked_at = new Date().toISOString();
      }
      return Promise.resolve();
    },
  ),
}));

// Imported after the mock declaration; vitest hoists vi.mock above imports.
import {
  handleClientRegistration,
  handleTokenRequest,
  issueAuthorizationCode,
  OAuthError,
  validateAuthorizeRequest,
} from "./oauth-server";

const db = {} as McpStoreClient;
const config = { origin: "https://app.example.com", jwtSecret: "x".repeat(40) };
const REDIRECT = "https://client.example.com/callback";

beforeEach(() => {
  state.clients.clear();
  state.codes.clear();
  state.refresh.clear();
});

async function fullFlow(): Promise<{
  clientId: string;
  verifier: string;
  code: string;
}> {
  const reg = await handleClientRegistration(db, {
    client_name: "Test",
    redirect_uris: [REDIRECT],
  });
  const verifier = "verifier-".padEnd(64, "abc");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: reg.client_id,
    redirect_uri: REDIRECT,
    code_challenge: s256(verifier),
    code_challenge_method: "S256",
    state: "xyz",
  });
  const validated = await validateAuthorizeRequest(db, params);
  const redirect = await issueAuthorizationCode(db, validated, "user-1");
  const code = new URL(redirect).searchParams.get("code") ?? "";
  return { clientId: reg.client_id, verifier, code };
}

describe("client registration", () => {
  it("registers a public client with a generated id", async () => {
    const reg = await handleClientRegistration(db, {
      redirect_uris: ["https://client.example.com/cb"],
    });
    expect(reg.client_id).toMatch(/^mcp_/);
    expect(reg.token_endpoint_auth_method).toBe("none");
  });

  it("rejects missing/invalid redirect_uris", async () => {
    await expect(handleClientRegistration(db, {})).rejects.toBeInstanceOf(
      OAuthError,
    );
    await expect(
      handleClientRegistration(db, { redirect_uris: ["ftp://nope"] }),
    ).rejects.toBeInstanceOf(OAuthError);
  });

  it("allows http only on loopback", async () => {
    await expect(
      handleClientRegistration(db, {
        redirect_uris: ["http://localhost:8080/cb"],
      }),
    ).resolves.toBeTruthy();
    await expect(
      handleClientRegistration(db, { redirect_uris: ["http://evil.com/cb"] }),
    ).rejects.toBeInstanceOf(OAuthError);
  });
});

describe("authorize", () => {
  it("rejects an unknown client", async () => {
    const params = new URLSearchParams({
      client_id: "nope",
      redirect_uri: "https://x/cb",
    });
    await expect(validateAuthorizeRequest(db, params)).rejects.toBeInstanceOf(
      OAuthError,
    );
  });

  it("rejects a redirect_uri not registered to the client", async () => {
    const reg = await handleClientRegistration(db, {
      redirect_uris: [REDIRECT],
    });
    const params = new URLSearchParams({
      response_type: "code",
      client_id: reg.client_id,
      redirect_uri: "https://client.example.com/evil",
      code_challenge: "x",
      code_challenge_method: "S256",
    });
    await expect(validateAuthorizeRequest(db, params)).rejects.toBeInstanceOf(
      OAuthError,
    );
  });
});

describe("token: authorization_code grant", () => {
  it("exchanges a valid code + verifier for tokens", async () => {
    const { clientId, verifier, code } = await fullFlow();
    const tokens = await handleTokenRequest(
      db,
      config,
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: REDIRECT,
        code_verifier: verifier,
      }),
    );
    expect(tokens.access_token.split(".")).toHaveLength(3);
    expect(tokens.refresh_token).toBeTruthy();
    expect(tokens.token_type).toBe("Bearer");
  });

  it("rejects a wrong PKCE verifier", async () => {
    const { clientId, code } = await fullFlow();
    await expect(
      handleTokenRequest(
        db,
        config,
        new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          redirect_uri: REDIRECT,
          code_verifier: "wrong-verifier",
        }),
      ),
    ).rejects.toBeInstanceOf(OAuthError);
  });

  it("rejects a code reused twice", async () => {
    const { clientId, verifier, code } = await fullFlow();
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      redirect_uri: REDIRECT,
      code_verifier: verifier,
    });
    await handleTokenRequest(db, config, form);
    await expect(handleTokenRequest(db, config, form)).rejects.toBeInstanceOf(
      OAuthError,
    );
  });
});

describe("token: refresh_token grant", () => {
  it("rotates the refresh token and detects reuse", async () => {
    const { clientId, verifier, code } = await fullFlow();
    const first = await handleTokenRequest(
      db,
      config,
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: REDIRECT,
        code_verifier: verifier,
      }),
    );

    const refreshForm = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: first.refresh_token,
      client_id: clientId,
    });
    const second = await handleTokenRequest(db, config, refreshForm);
    expect(second.refresh_token).not.toBe(first.refresh_token);

    // Re-using the now-rotated first token is reuse → rejected, and the whole
    // chain (incl. the new token) is revoked.
    await expect(
      handleTokenRequest(db, config, refreshForm),
    ).rejects.toBeInstanceOf(OAuthError);
    expect(
      state.refresh.get(hashToken(second.refresh_token))?.revoked_at,
    ).toBeTruthy();
  });
});
