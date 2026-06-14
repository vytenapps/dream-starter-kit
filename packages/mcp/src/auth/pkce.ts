import { createHash } from "node:crypto";

/**
 * PKCE (RFC 7636) — S256 only. The MCP authorization spec requires PKCE for all
 * clients; we reject the `plain` method outright. These helpers are pure (no
 * `server-only`, no I/O) so they unit-test directly.
 */

/** base64url(SHA-256(input)) — the S256 transform, no padding. */
export function s256(input: string): string {
  return createHash("sha256").update(input).digest("base64url");
}

/**
 * Verify a PKCE code_verifier against the stored code_challenge using S256.
 * Constant-time-ish via length check + digest compare on equal-length strings.
 */
export function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false;
  const computed = s256(verifier);
  if (computed.length !== challenge.length) return false;
  // Both are base64url of a 32-byte digest, so a plain compare is fine here;
  // there is no secret being compared (the challenge is public).
  let mismatch = 0;
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed.charCodeAt(i) ^ challenge.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Only S256 is accepted (spec + security). */
export function isSupportedChallengeMethod(method: string | undefined): boolean {
  return method === "S256";
}
