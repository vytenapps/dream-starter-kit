import { createHash, randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";

/**
 * Token primitives for the MCP OAuth server. Access tokens are stateless signed
 * JWTs (HS256) so the hot path — every MCP request — verifies with no DB hit.
 * Authorization codes and refresh tokens are opaque random strings; refresh
 * tokens are stored only as a SHA-256 hash and rotated on use.
 *
 * Pure (no `server-only`): unit-testable directly.
 */

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const AUTHORIZATION_CODE_TTL_SECONDS = 60; // 1 minute, single-use

export interface AccessTokenClaims {
  /** Supabase user id (= profiles.id) the token authorizes. */
  sub: string;
  /** OAuth client the token was issued to. */
  client_id: string;
  scope: string;
}

const secretKey = (secret: string) => new TextEncoder().encode(secret);

/** Mint a signed access-token JWT. Returns the token and its lifetime. */
export async function mintAccessToken(params: {
  secret: string;
  issuer: string;
  audience: string;
  subject: string;
  clientId: string;
  scope: string;
  ttlSeconds?: number;
}): Promise<{ token: string; expiresIn: number }> {
  const ttl = params.ttlSeconds ?? ACCESS_TOKEN_TTL_SECONDS;
  const token = await new SignJWT({
    client_id: params.clientId,
    scope: params.scope,
  })
    .setProtectedHeader({ alg: "HS256", typ: "at+jwt" })
    .setSubject(params.subject)
    .setIssuer(params.issuer)
    .setAudience(params.audience)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(secretKey(params.secret));
  return { token, expiresIn: ttl };
}

/**
 * Verify an access-token JWT (signature, issuer, audience, expiry). Throws if
 * invalid/expired. Returns the typed claims on success.
 */
export async function verifyAccessToken(params: {
  secret: string;
  issuer: string;
  audience: string;
  token: string;
}): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(params.token, secretKey(params.secret), {
    issuer: params.issuer,
    audience: params.audience,
  });
  if (
    typeof payload.sub !== "string" ||
    typeof payload.client_id !== "string" ||
    typeof payload.scope !== "string"
  ) {
    throw new Error("Access token is missing required claims");
  }
  return {
    sub: payload.sub,
    client_id: payload.client_id,
    scope: payload.scope,
  };
}

/** A URL-safe, high-entropy opaque token (authorization codes, refresh tokens). */
export function generateOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

/** SHA-256 hex of an opaque token — what we persist for refresh tokens. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A random OAuth client id (RFC 7591 dynamic registration). */
export function generateClientId(): string {
  return `mcp_${randomBytes(16).toString("hex")}`;
}
