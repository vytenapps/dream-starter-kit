import { describe, expect, it } from "vitest";

import {
  generateClientId,
  generateOpaqueToken,
  hashToken,
  mintAccessToken,
  verifyAccessToken,
} from "./tokens";

const base = {
  secret: "test-secret-value-at-least-32-bytes-long!!",
  issuer: "https://app.example.com",
  audience: "https://app.example.com/mcp",
};

describe("access tokens", () => {
  it("mints and verifies a token round-trip", async () => {
    const { token, expiresIn } = await mintAccessToken({
      ...base,
      subject: "user-123",
      clientId: "mcp_abc",
      scope: "mcp",
    });
    expect(expiresIn).toBe(3600);
    const claims = await verifyAccessToken({ ...base, token });
    expect(claims.sub).toBe("user-123");
    expect(claims.client_id).toBe("mcp_abc");
    expect(claims.scope).toBe("mcp");
  });

  it("rejects a token signed with a different secret", async () => {
    const { token } = await mintAccessToken({
      ...base,
      subject: "u",
      clientId: "c",
      scope: "mcp",
    });
    await expect(
      verifyAccessToken({ ...base, secret: "a-totally-different-secret-value", token }),
    ).rejects.toThrow();
  });

  it("rejects a token for the wrong audience", async () => {
    const { token } = await mintAccessToken({
      ...base,
      subject: "u",
      clientId: "c",
      scope: "mcp",
    });
    await expect(
      verifyAccessToken({ ...base, audience: "https://evil.example.com/mcp", token }),
    ).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const { token } = await mintAccessToken({
      ...base,
      subject: "u",
      clientId: "c",
      scope: "mcp",
      ttlSeconds: -1,
    });
    await expect(verifyAccessToken({ ...base, token })).rejects.toThrow();
  });
});

describe("opaque tokens", () => {
  it("generates unique high-entropy tokens", () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
  });

  it("hashes deterministically", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });

  it("generates client ids with the mcp_ prefix", () => {
    expect(generateClientId()).toMatch(/^mcp_[0-9a-f]{32}$/);
  });
});
