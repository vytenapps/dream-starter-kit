import { describe, expect, it } from "vitest";

import { cmsConfigStatus, cmsNotConfiguredMessage } from "./env-status";

const INTEGRATION_ENV = {
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test_key",
  POSTGRES_URL_NON_POOLING:
    "postgres://postgres.ref:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require",
};

describe("cmsConfigStatus", () => {
  it("is explicit when both vars are set by hand", () => {
    expect(
      cmsConfigStatus({
        PAYLOAD_SECRET: "s3cret",
        PAYLOAD_DATABASE_URL: "postgresql://payload_cms:pw@host/db",
      }),
    ).toEqual({ mode: "explicit", configured: true, missing: [] });
  });

  it("is derived when the integration env covers the gaps (zero-touch)", () => {
    expect(cmsConfigStatus(INTEGRATION_ENV)).toEqual({
      mode: "derived",
      configured: true,
      missing: [],
    });
  });

  it("is derived in mixed mode too", () => {
    expect(
      cmsConfigStatus({ ...INTEGRATION_ENV, PAYLOAD_SECRET: "s3cret" }).mode,
    ).toBe("derived");
  });

  it("is unconfigured with the unresolvable names when nothing usable is set", () => {
    expect(cmsConfigStatus({})).toEqual({
      mode: "unconfigured",
      configured: false,
      missing: ["PAYLOAD_SECRET", "PAYLOAD_DATABASE_URL"],
    });
    // Seed alone derives the secret but not the connection string.
    expect(
      cmsConfigStatus({ SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test_key" }),
    ).toEqual({
      mode: "unconfigured",
      configured: false,
      missing: ["PAYLOAD_DATABASE_URL"],
    });
  });
});

describe("cmsNotConfiguredMessage", () => {
  it("names the vars, the zero-touch alternative, and where to look", () => {
    const message = cmsNotConfiguredMessage([
      "PAYLOAD_SECRET",
      "PAYLOAD_DATABASE_URL",
    ]);
    expect(message).toContain("PAYLOAD_SECRET and PAYLOAD_DATABASE_URL");
    expect(message).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(message).toContain("/api/health/db");
    expect(message).toContain("Content backend");
  });
});
