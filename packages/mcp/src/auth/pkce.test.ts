import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { isSupportedChallengeMethod, s256, verifyPkceS256 } from "./pkce";

describe("pkce", () => {
  it("s256 matches base64url(sha256(verifier))", () => {
    const verifier = "the-quick-brown-fox";
    const expected = createHash("sha256").update(verifier).digest("base64url");
    expect(s256(verifier)).toBe(expected);
  });

  it("verifies a valid verifier/challenge pair", () => {
    const verifier = randomBytes(32).toString("base64url");
    const challenge = s256(verifier);
    expect(verifyPkceS256(verifier, challenge)).toBe(true);
  });

  it("rejects a tampered verifier", () => {
    const verifier = randomBytes(32).toString("base64url");
    const challenge = s256(verifier);
    expect(verifyPkceS256(verifier + "x", challenge)).toBe(false);
  });

  it("rejects empty inputs", () => {
    expect(verifyPkceS256("", "")).toBe(false);
    expect(verifyPkceS256("a", "")).toBe(false);
    expect(verifyPkceS256("", "b")).toBe(false);
  });

  it("only supports S256", () => {
    expect(isSupportedChallengeMethod("S256")).toBe(true);
    expect(isSupportedChallengeMethod("plain")).toBe(false);
    expect(isSupportedChallengeMethod(undefined)).toBe(false);
  });
});
