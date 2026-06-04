import { describe, expect, it } from "vitest";

import {
  authCodeFunnelNext,
  normalizeOrigin,
  originFromHeaders,
} from "./auth-redirect";

describe("normalizeOrigin", () => {
  it("adds https:// when no scheme is present (bare Vercel host)", () => {
    expect(normalizeOrigin("my-app.vercel.app")).toBe(
      "https://my-app.vercel.app",
    );
  });

  it("preserves an existing scheme", () => {
    expect(normalizeOrigin("http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
    expect(normalizeOrigin("https://app.example.com")).toBe(
      "https://app.example.com",
    );
  });

  it("strips trailing slashes", () => {
    expect(normalizeOrigin("https://app.example.com/")).toBe(
      "https://app.example.com",
    );
    expect(normalizeOrigin("https://app.example.com///")).toBe(
      "https://app.example.com",
    );
  });
});

describe("originFromHeaders", () => {
  it("builds the origin from x-forwarded-host + x-forwarded-proto", () => {
    const headers = new Headers({
      "x-forwarded-host": "dream-starter-kit003.vercel.app",
      "x-forwarded-proto": "https",
    });
    expect(originFromHeaders(headers)).toBe(
      "https://dream-starter-kit003.vercel.app",
    );
  });

  it("defaults the scheme to https when no proto header is set", () => {
    const headers = new Headers({ host: "dream-starter-kit003.vercel.app" });
    expect(originFromHeaders(headers)).toBe(
      "https://dream-starter-kit003.vercel.app",
    );
  });

  it("prefers x-forwarded-host over host", () => {
    const headers = new Headers({
      "x-forwarded-host": "public.vercel.app",
      host: "internal.local",
    });
    expect(originFromHeaders(headers)).toBe("https://public.vercel.app");
  });

  it("honors a non-https forwarded proto (local dev)", () => {
    const headers = new Headers({
      host: "localhost:3000",
      "x-forwarded-proto": "http",
    });
    expect(originFromHeaders(headers)).toBe("http://localhost:3000");
  });

  it("returns null when no host header is present", () => {
    expect(originFromHeaders(new Headers())).toBeNull();
  });
});

describe("authCodeFunnelNext", () => {
  it("does not funnel requests already on /auth/callback", () => {
    expect(
      authCodeFunnelNext("/auth/callback", new URLSearchParams("code=abc")),
    ).toBeNull();
  });

  it("funnels a bare site-root code landing to the dashboard", () => {
    expect(authCodeFunnelNext("/", new URLSearchParams("code=abc"))).toBe(
      "/dashboard",
    );
  });

  it("preserves a same-origin landing path as the next destination", () => {
    expect(
      authCodeFunnelNext("/reminders", new URLSearchParams("code=abc")),
    ).toBe("/reminders");
  });

  it("also funnels token_hash (OTP) landings", () => {
    expect(
      authCodeFunnelNext(
        "/",
        new URLSearchParams("token_hash=xyz&type=signup"),
      ),
    ).toBe("/dashboard");
  });

  it("ignores requests without an auth code", () => {
    expect(authCodeFunnelNext("/", new URLSearchParams())).toBeNull();
    expect(
      authCodeFunnelNext("/dashboard", new URLSearchParams("checkout=success")),
    ).toBeNull();
  });
});
