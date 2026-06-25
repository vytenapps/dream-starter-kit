import { describe, expect, it } from "vitest";

import {
  chooserEntries,
  DEFAULT_AUTH_SETTINGS,
  isEmailDomainAllowed,
  normalizeAuthSettings,
  resolveDefaultMethod,
  ssoParamsForEmail,
} from "./auth-settings";

describe("auth-settings normalizer", () => {
  it("falls back to kit defaults for null/empty input", () => {
    const s = normalizeAuthSettings(null);
    expect(s.orderedMethods).toEqual(["magicLink", "emailOtp", "password"]);
    expect(s.methods.google).toBe(false);
    expect(s.termsUrl).toBe("/terms");
    expect(s).toEqual(DEFAULT_AUTH_SETTINGS);
  });

  it("honors a reordered + toggled method list and backfills missing methods", () => {
    const s = normalizeAuthSettings({
      loginMethods: [
        { method: "google", enabled: true },
        { method: "password", enabled: true },
        { method: "magicLink", enabled: false },
      ],
    });
    // Order is preserved; disabled + omitted methods drop out of orderedMethods.
    expect(s.orderedMethods).toEqual(["google", "password"]);
    expect(resolveDefaultMethod(s)).toBe("google");
    // Every method is still present once in the full list (backfilled disabled).
    expect(s.loginMethods.map((r) => r.method).sort()).toEqual(
      ["apple", "emailOtp", "google", "magicLink", "password", "sso"].sort(),
    );
    expect(s.methods.emailOtp).toBe(false);
  });

  it("collapses email methods into one chooser entry at the first enabled position", () => {
    const s = normalizeAuthSettings({
      loginMethods: [
        { method: "google", enabled: true },
        { method: "magicLink", enabled: true },
        { method: "password", enabled: true },
        { method: "sso", enabled: true },
      ],
    });
    expect(chooserEntries(s)).toEqual(["google", "email", "sso"]);
  });

  it("clamps the minimum password length to [6, 72]", () => {
    expect(normalizeAuthSettings({ minPasswordLength: 2 }).minPasswordLength).toBe(6);
    expect(normalizeAuthSettings({ minPasswordLength: 999 }).minPasswordLength).toBe(72);
    expect(normalizeAuthSettings({ minPasswordLength: 12 }).minPasswordLength).toBe(12);
  });
});

describe("email domain rules", () => {
  const base = normalizeAuthSettings({
    emailDomainMode: "allowlist",
    emailDomains: [{ domain: "Acme.com" }],
  });

  it("allows everything when mode is off", () => {
    expect(isEmailDomainAllowed("x@any.com", DEFAULT_AUTH_SETTINGS)).toBe(true);
  });

  it("enforces an allowlist (case-insensitive)", () => {
    expect(isEmailDomainAllowed("jo@acme.com", base)).toBe(true);
    expect(isEmailDomainAllowed("jo@evil.com", base)).toBe(false);
  });

  it("enforces a blocklist", () => {
    const block = normalizeAuthSettings({
      emailDomainMode: "blocklist",
      emailDomains: [{ domain: "spam.com" }],
    });
    expect(isEmailDomainAllowed("jo@spam.com", block)).toBe(false);
    expect(isEmailDomainAllowed("jo@ok.com", block)).toBe(true);
  });
});

describe("sso routing", () => {
  const s = normalizeAuthSettings({
    ssoDomains: [
      { domain: "acme.com", providerId: "prov-123" },
      { domain: "bydomain.com" },
    ],
  });

  it("resolves a provider id when configured", () => {
    expect(ssoParamsForEmail("jo@acme.com", s)).toEqual({ providerId: "prov-123" });
  });

  it("falls back to the bare domain when no provider id is set", () => {
    expect(ssoParamsForEmail("jo@bydomain.com", s)).toEqual({
      domain: "bydomain.com",
    });
  });

  it("returns null for an unmapped domain", () => {
    expect(ssoParamsForEmail("jo@other.com", s)).toBeNull();
  });
});
