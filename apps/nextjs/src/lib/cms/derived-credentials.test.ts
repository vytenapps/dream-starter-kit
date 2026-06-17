import { describe, expect, it } from "vitest";

import {
  derivePayloadDatabaseUrl,
  derivePayloadPassword,
  derivePayloadSecret,
  resolveCmsCredentials,
} from "./derived-credentials";

const SEED = "sb_secret_test_service_role_key";

describe("derivePayloadSecret / derivePayloadPassword", () => {
  it("is deterministic and seed-dependent", () => {
    expect(derivePayloadSecret(SEED)).toBe(derivePayloadSecret(SEED));
    expect(derivePayloadPassword(SEED)).toBe(derivePayloadPassword(SEED));
    expect(derivePayloadSecret("other")).not.toBe(derivePayloadSecret(SEED));
  });

  it("derives DIFFERENT values for secret vs password (distinct contexts)", () => {
    expect(derivePayloadSecret(SEED)).not.toBe(derivePayloadPassword(SEED));
  });

  it("emits url-safe hex (no percent-encoding needed in the connection string)", () => {
    expect(derivePayloadSecret(SEED)).toMatch(/^[0-9a-f]{64}$/);
    expect(derivePayloadPassword(SEED)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("derivePayloadDatabaseUrl", () => {
  const PW = "deadbeef";

  it("rewrites a direct connection: payload_cms user + search_path, rest untouched", () => {
    expect(
      derivePayloadDatabaseUrl(
        "postgresql://postgres:adm%40n@db.ref.supabase.co:5432/postgres",
        PW,
      ),
    ).toBe(
      "postgresql://payload_cms:deadbeef@db.ref.supabase.co:5432/postgres?options=-c%20search_path%3Dcms",
    );
  });

  it("keeps the Supavisor tenant suffix on the username (postgres.<ref> → payload_cms.<ref>)", () => {
    expect(
      derivePayloadDatabaseUrl(
        "postgres://postgres.abcdefgh:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require&supa=base-pooler.x",
        PW,
      ),
    ).toBe(
      "postgres://payload_cms.abcdefgh:deadbeef@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require&supa=base-pooler.x&options=-c%20search_path%3Dcms",
    );
  });

  it("handles a local URL with no existing query", () => {
    expect(
      derivePayloadDatabaseUrl(
        "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
        PW,
      ),
    ).toBe(
      "postgresql://payload_cms:deadbeef@127.0.0.1:54322/postgres?options=-c%20search_path%3Dcms",
    );
  });

  it("refuses URLs that already carry an options param (would conflict)", () => {
    expect(
      derivePayloadDatabaseUrl(
        "postgresql://postgres:pw@host/db?options=-c%20statement_timeout%3D1s",
        PW,
      ),
    ).toBeUndefined();
  });

  it("refuses unparseable input", () => {
    expect(derivePayloadDatabaseUrl("host=x port=5432", PW)).toBeUndefined();
  });
});

describe("resolveCmsCredentials", () => {
  const INTEGRATION_ENV = {
    SUPABASE_SERVICE_ROLE_KEY: SEED,
    POSTGRES_URL_NON_POOLING:
      "postgres://postgres.ref:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require",
  };

  it("derives both credentials from the integration env alone (zero-touch)", () => {
    const creds = resolveCmsCredentials(INTEGRATION_ENV);
    expect(creds.secret).toBe(derivePayloadSecret(SEED));
    expect(creds.databaseUrl).toContain("payload_cms.ref:");
    expect(creds.databaseUrl).toContain(derivePayloadPassword(SEED));
    expect(creds.derived).toEqual({ secret: true, databaseUrl: true });
  });

  it("derives a TRANSACTION-mode runtime pool URL (:6543) while the lock/DDL URL stays session-mode (:5432)", () => {
    // The Vercel<->Supabase integration injects POSTGRES_URL as the transaction
    // pooler (6543); the runtime Payload query pool should use it so a cold-start
    // burst can't exhaust the session-mode client cap (EMAXCONNSESSION). The
    // bootstrap/advisory-lock/DDL connection (`databaseUrl`) stays on the session
    // pooler (5432). Both carry the same derived payload_cms credentials.
    const creds = resolveCmsCredentials({
      SUPABASE_SERVICE_ROLE_KEY: SEED,
      POSTGRES_URL:
        "postgres://postgres.ref:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require",
    });
    const password = derivePayloadPassword(SEED);
    // runtime → transaction pooler (6543)
    expect(creds.runtimeDatabaseUrl).toBe(
      `postgres://payload_cms.ref:${password}@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&options=-c%20search_path%3Dcms`,
    );
    // session/DDL → session pooler (5432), derived from the same POSTGRES_URL
    expect(creds.databaseUrl).toBe(
      `postgres://payload_cms.ref:${password}@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require&options=-c%20search_path%3Dcms`,
    );
  });

  it("falls back to the session/direct URL for the runtime pool when no :6543 pooler exists", () => {
    // Only the session pooler is available (no transaction POSTGRES_URL) — the
    // runtime pool URL matches the session/DDL URL, i.e. behavior is unchanged.
    const creds = resolveCmsCredentials(INTEGRATION_ENV);
    expect(creds.runtimeDatabaseUrl).toBe(creds.databaseUrl);
    expect(creds.runtimeDatabaseUrl).toContain(":5432/");
  });

  it("explicit env always wins over derivation (for both connections)", () => {
    const creds = resolveCmsCredentials({
      ...INTEGRATION_ENV,
      // even with a transaction pooler present, an explicit URL pins both
      POSTGRES_URL:
        "postgres://postgres.ref:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
      PAYLOAD_SECRET: "explicit-secret",
      PAYLOAD_DATABASE_URL: "postgresql://payload_cms:explicit@host/db",
    });
    expect(creds.secret).toBe("explicit-secret");
    expect(creds.databaseUrl).toBe("postgresql://payload_cms:explicit@host/db");
    expect(creds.runtimeDatabaseUrl).toBe(
      "postgresql://payload_cms:explicit@host/db",
    );
    expect(creds.derived).toEqual({ secret: false, databaseUrl: false });
  });

  it("supports mixed mode (one explicit, one derived)", () => {
    const creds = resolveCmsCredentials({
      ...INTEGRATION_ENV,
      PAYLOAD_SECRET: "explicit-secret",
    });
    expect(creds.secret).toBe("explicit-secret");
    expect(creds.derived).toEqual({ secret: false, databaseUrl: true });
  });

  it("derives nothing without the service-role key (empty string included)", () => {
    expect(
      resolveCmsCredentials({
        POSTGRES_URL_NON_POOLING: INTEGRATION_ENV.POSTGRES_URL_NON_POOLING,
        SUPABASE_SERVICE_ROLE_KEY: "",
      }),
    ).toEqual({
      secret: undefined,
      databaseUrl: undefined,
      runtimeDatabaseUrl: undefined,
      derived: { secret: false, databaseUrl: false },
    });
  });

  it("derives the secret but no URL when no admin db url exists", () => {
    const creds = resolveCmsCredentials({ SUPABASE_SERVICE_ROLE_KEY: SEED });
    expect(creds.secret).toBeDefined();
    expect(creds.databaseUrl).toBeUndefined();
    expect(creds.runtimeDatabaseUrl).toBeUndefined();
    expect(creds.derived).toEqual({ secret: true, databaseUrl: false });
  });

  it("prefers SUPABASE_DB_URL over POSTGRES_URL_NON_POOLING (same as the bootstrap)", () => {
    const creds = resolveCmsCredentials({
      ...INTEGRATION_ENV,
      SUPABASE_DB_URL:
        "postgresql://postgres:pw@db.ref.supabase.co:5432/postgres",
    });
    expect(creds.databaseUrl).toContain("@db.ref.supabase.co:5432");
  });
});
