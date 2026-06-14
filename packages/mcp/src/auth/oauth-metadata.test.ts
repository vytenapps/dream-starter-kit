import { describe, expect, it } from "vitest";

import {
  authorizationServerMetadata,
  protectedResourceMetadata,
  resourceIdentifier,
} from "./oauth-metadata";

describe("oauth metadata", () => {
  it("protected-resource metadata points at /mcp and the AS", () => {
    const meta = protectedResourceMetadata("https://app.example.com");
    expect(meta.resource).toBe("https://app.example.com/mcp");
    expect(meta.authorization_servers).toEqual(["https://app.example.com"]);
    expect(meta.bearer_methods_supported).toContain("header");
  });

  it("authorization-server metadata advertises the endpoints + S256", () => {
    const meta = authorizationServerMetadata("https://app.example.com");
    expect(meta.issuer).toBe("https://app.example.com");
    expect(meta.authorization_endpoint).toBe(
      "https://app.example.com/oauth/authorize",
    );
    expect(meta.token_endpoint).toBe("https://app.example.com/oauth/token");
    expect(meta.registration_endpoint).toBe(
      "https://app.example.com/oauth/register",
    );
    expect(meta.code_challenge_methods_supported).toEqual(["S256"]);
    expect(meta.grant_types_supported).toContain("authorization_code");
    expect(meta.grant_types_supported).toContain("refresh_token");
  });

  it("trims a trailing slash from the origin", () => {
    expect(resourceIdentifier("https://app.example.com/")).toBe(
      "https://app.example.com/mcp",
    );
    const meta = authorizationServerMetadata("https://app.example.com/");
    expect(meta.issuer).toBe("https://app.example.com");
  });
});
