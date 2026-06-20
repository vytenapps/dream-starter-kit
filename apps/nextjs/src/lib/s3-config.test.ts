import { describe, expect, it } from "vitest";

import type { S3ConfigSource } from "./s3-config";
import {
  isS3Configured,
  projectRefFromUrl,
  regionFromPostgresUrl,
  resolveS3Config,
} from "./s3-config";

const REF = "abcdefghijklmnop";
const SUPABASE_SESSION_ENV: S3ConfigSource = {
  SUPABASE_URL: `https://${REF}.supabase.co`,
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-jwt",
  POSTGRES_URL:
    "postgres://postgres.ref:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
};

describe("projectRefFromUrl", () => {
  it("extracts the ref subdomain", () => {
    expect(projectRefFromUrl(`https://${REF}.supabase.co`)).toBe(REF);
  });
  it("returns undefined for local/non-supabase urls", () => {
    expect(projectRefFromUrl("http://127.0.0.1:54321")).toBeUndefined();
    expect(projectRefFromUrl(undefined)).toBeUndefined();
  });
});

describe("regionFromPostgresUrl", () => {
  it("parses the region from the Supavisor pooler host", () => {
    expect(
      regionFromPostgresUrl(
        "postgres://u:p@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
      ),
    ).toBe("us-east-1");
    expect(
      regionFromPostgresUrl(
        "postgres://u:p@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres",
      ),
    ).toBe("ap-southeast-2");
  });
  it("returns undefined for non-pooler hosts", () => {
    expect(
      regionFromPostgresUrl("postgres://u:p@db.localhost:5432/postgres"),
    ).toBeUndefined();
  });
});

describe("resolveS3Config — dedicated keys mode", () => {
  it("uses S3_ACCESS_KEY_ID/SECRET with no session token", () => {
    const cfg = resolveS3Config({
      S3_ENDPOINT: "http://127.0.0.1:54321/storage/v1/s3",
      S3_REGION: "local",
      S3_ACCESS_KEY_ID: "stub",
      S3_SECRET_ACCESS_KEY: "secret",
    });
    expect(cfg).toEqual({
      bucket: "cms-media",
      endpoint: "http://127.0.0.1:54321/storage/v1/s3",
      region: "local",
      forcePathStyle: true,
      credentials: { accessKeyId: "stub", secretAccessKey: "secret" },
    });
  });

  it("takes precedence over Supabase env", () => {
    const cfg = resolveS3Config({
      ...SUPABASE_SESSION_ENV,
      S3_ACCESS_KEY_ID: "stub",
      S3_SECRET_ACCESS_KEY: "secret",
    });
    expect(cfg?.credentials.accessKeyId).toBe("stub");
    expect(cfg?.credentials.sessionToken).toBeUndefined();
  });
});

describe("resolveS3Config — Supabase session-token mode", () => {
  it("derives endpoint + region and uses ref/anon/service-role creds", () => {
    const cfg = resolveS3Config(SUPABASE_SESSION_ENV);
    expect(cfg).toEqual({
      bucket: "cms-media",
      endpoint: `https://${REF}.storage.supabase.co/storage/v1/s3`,
      region: "eu-central-1",
      forcePathStyle: true,
      credentials: {
        accessKeyId: REF,
        secretAccessKey: "anon-key",
        sessionToken: "service-role-jwt",
      },
    });
  });

  it("lets explicit S3_ENDPOINT/S3_REGION win over derivation", () => {
    const cfg = resolveS3Config({
      ...SUPABASE_SESSION_ENV,
      S3_ENDPOINT: "https://custom.example.com/s3",
      S3_REGION: "custom-region",
    });
    expect(cfg?.endpoint).toBe("https://custom.example.com/s3");
    expect(cfg?.region).toBe("custom-region");
    // still session-token creds
    expect(cfg?.credentials.sessionToken).toBe("service-role-jwt");
  });

  it("falls back to us-east-1 when no pooler host is present", () => {
    const cfg = resolveS3Config({
      ...SUPABASE_SESSION_ENV,
      POSTGRES_URL: undefined,
    });
    expect(cfg?.region).toBe("us-east-1");
  });

  it("accepts the publishable-key name for the anon secret", () => {
    const cfg = resolveS3Config({
      SUPABASE_URL: `https://${REF}.supabase.co`,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pub-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-jwt",
    });
    expect(cfg?.credentials.secretAccessKey).toBe("pub-key");
  });
});

describe("isS3Configured", () => {
  it("is false when neither mode is satisfied", () => {
    expect(isS3Configured({})).toBe(false);
    expect(resolveS3Config({})).toBeNull();
    // partial supabase env (no service role) is not enough
    expect(
      isS3Configured({ SUPABASE_URL: `https://${REF}.supabase.co` }),
    ).toBe(false);
  });
  it("is true in either mode", () => {
    expect(
      isS3Configured({ S3_ACCESS_KEY_ID: "a", S3_SECRET_ACCESS_KEY: "b" }),
    ).toBe(true);
    expect(isS3Configured(SUPABASE_SESSION_ENV)).toBe(true);
  });
});
