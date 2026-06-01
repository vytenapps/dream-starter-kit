import { describe, expect, it } from "vitest";

import { parseClientEnv, parseServerEnv, serverEnvSchema } from "./env";

const validServer = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

describe("serverEnvSchema", () => {
  it("accepts a minimal valid env and applies the APP_URL default", () => {
    const env = parseServerEnv(validServer);
    expect(env.SUPABASE_URL).toBe("http://127.0.0.1:54321");
    expect(env.APP_URL).toBe("http://localhost:3000");
  });

  it("fails loudly when a required variable is missing", () => {
    expect(() =>
      parseServerEnv({ ...validServer, SUPABASE_SERVICE_ROLE_KEY: undefined }),
    ).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("rejects a malformed URL", () => {
    expect(() =>
      parseServerEnv({ ...validServer, SUPABASE_URL: "not-a-url" }),
    ).toThrow(/SUPABASE_URL/);
  });

  it("treats Stripe/AI keys as optional until configured", () => {
    const env = parseServerEnv(validServer);
    expect(env.STRIPE_SECRET_KEY).toBeUndefined();
    expect(env.AI_GATEWAY_API_KEY).toBeUndefined();
    expect(serverEnvSchema.safeParse(validServer).success).toBe(true);
  });
});

describe("clientEnvSchema", () => {
  it("validates the client-safe subset", () => {
    const env = parseClientEnv({
      SUPABASE_URL: "https://abc.supabase.co",
      SUPABASE_ANON_KEY: "anon",
      APP_URL: "https://example.com",
    });
    expect(env.SUPABASE_ANON_KEY).toBe("anon");
  });

  it("rejects a missing anon key", () => {
    expect(() =>
      parseClientEnv({
        SUPABASE_URL: "https://abc.supabase.co",
        SUPABASE_ANON_KEY: "",
        APP_URL: "https://example.com",
      }),
    ).toThrow(/SUPABASE_ANON_KEY/);
  });
});
