import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { SqlMigration } from "./migrations";
import {
  cmsProvisionStatements,
  parseMigrationFilename,
  parseRoleCredentials,
  pendingMigrations,
  pgConnectionOptions,
  resolveAdminDbUrl,
  resolveRuntimeDbUrl,
  summarizeDbError,
  transactionPoolerUrl,
} from "./bootstrap-core";

const mig = (version: string, name = `m${version}`): SqlMigration => ({
  version,
  name,
  sql: `select '${version}'`,
});

describe("parseMigrationFilename", () => {
  it("parses <14-digit-version>_<name>.sql", () => {
    expect(parseMigrationFilename("20260609000001_initial.sql")).toEqual({
      version: "20260609000001",
      name: "initial",
    });
    expect(parseMigrationFilename("20260610000001_add_user_tags.sql")).toEqual({
      version: "20260610000001",
      name: "add_user_tags",
    });
  });

  it("rejects malformed names", () => {
    expect(parseMigrationFilename("20260609_initial.sql")).toBeNull(); // short version
    expect(parseMigrationFilename("20260609000001.sql")).toBeNull(); // no name
    expect(parseMigrationFilename("20260609000001_initial.txt")).toBeNull();
    expect(parseMigrationFilename("README.md")).toBeNull();
  });
});

describe("resolveAdminDbUrl", () => {
  it("prefers the explicit SUPABASE_DB_URL", () => {
    expect(
      resolveAdminDbUrl({
        SUPABASE_DB_URL: "postgresql://a",
        POSTGRES_URL_NON_POOLING: "postgresql://b",
      }),
    ).toBe("postgresql://a");
  });

  it("falls back to the Vercel-injected POSTGRES_URL_NON_POOLING", () => {
    expect(
      resolveAdminDbUrl({ POSTGRES_URL_NON_POOLING: "postgresql://b" }),
    ).toBe("postgresql://b");
  });

  it("returns undefined when neither is set (incl. empty strings)", () => {
    expect(resolveAdminDbUrl({})).toBeUndefined();
    expect(
      resolveAdminDbUrl({ SUPABASE_DB_URL: "", POSTGRES_URL_NON_POOLING: "" }),
    ).toBeUndefined();
  });

  it("derives the IPv4 session pooler from POSTGRES_URL (6543 → 5432)", () => {
    // The Vercel<->Supabase integration injects POSTGRES_URL as the IPv4
    // TRANSACTION pooler; the bootstrap needs the SESSION pooler (same host,
    // port 5432) because POSTGRES_URL_NON_POOLING is IPv6-only on Vercel.
    expect(
      resolveAdminDbUrl({
        POSTGRES_URL:
          "postgres://postgres.ref:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require",
        POSTGRES_URL_NON_POOLING:
          "postgresql://postgres:pw@db.ref.supabase.co:5432/postgres",
      }),
    ).toBe(
      "postgres://postgres.ref:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require",
    );
  });

  it("ignores a POSTGRES_URL that isn't a :6543 Supavisor pooler URL", () => {
    // Not a pooler host → can't assume session semantics; fall through.
    expect(
      resolveAdminDbUrl({
        POSTGRES_URL:
          "postgresql://postgres:pw@db.ref.supabase.co:6543/postgres",
        POSTGRES_URL_NON_POOLING: "postgresql://direct",
      }),
    ).toBe("postgresql://direct");
    // Pooler host but already session-mode (5432) → no rewrite needed, and not
    // a 6543 transaction URL, so it's left for the NON_POOLING fallback.
    expect(
      resolveAdminDbUrl({
        POSTGRES_URL: "postgresql://pooled",
      }),
    ).toBeUndefined();
  });

  it("prefers the session pooler over the direct POSTGRES_URL_NON_POOLING", () => {
    expect(
      resolveAdminDbUrl({
        POSTGRES_URL:
          "postgres://postgres.ref:pw@aws-1-eu-west-2.pooler.supabase.com:6543/postgres",
        POSTGRES_URL_NON_POOLING:
          "postgresql://postgres:pw@db.ref.supabase.co:5432/postgres",
      }),
    ).toBe(
      "postgres://postgres.ref:pw@aws-1-eu-west-2.pooler.supabase.com:5432/postgres",
    );
  });
});

describe("transactionPoolerUrl", () => {
  it("returns a :6543 Supavisor pooler URL byte-for-byte", () => {
    const url =
      "postgres://postgres.ref:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x";
    expect(transactionPoolerUrl(url)).toBe(url);
  });

  it("rejects anything that isn't a :6543 pooler host", () => {
    // Session pooler (5432) — not the transaction one.
    expect(
      transactionPoolerUrl(
        "postgres://postgres.ref:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
      ),
    ).toBeUndefined();
    // Direct/custom host on 6543 — can't assume it multiplexes.
    expect(
      transactionPoolerUrl(
        "postgresql://postgres:pw@db.ref.supabase.co:6543/postgres",
      ),
    ).toBeUndefined();
    expect(transactionPoolerUrl(undefined)).toBeUndefined();
    expect(transactionPoolerUrl("not a url")).toBeUndefined();
  });
});

describe("resolveRuntimeDbUrl", () => {
  it("prefers the TRANSACTION pooler (:6543) for the per-request pool", () => {
    // The runtime query pool wants transaction mode so a cold-start burst can't
    // exhaust the session-mode client cap (EMAXCONNSESSION). The bootstrap, by
    // contrast, rewrites the SAME POSTGRES_URL down to the session pooler (5432).
    const env = {
      POSTGRES_URL:
        "postgres://postgres.ref:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require",
      POSTGRES_URL_NON_POOLING:
        "postgresql://postgres:pw@db.ref.supabase.co:5432/postgres",
    };
    expect(resolveRuntimeDbUrl(env)).toBe(
      "postgres://postgres.ref:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require",
    );
    // Same env, the bootstrap path still resolves the SESSION pooler (5432).
    expect(resolveAdminDbUrl(env)).toBe(
      "postgres://postgres.ref:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require",
    );
  });

  it("falls back to the session/direct admin URL when no :6543 pooler exists", () => {
    // Local dev / non-integration: no transaction pooler, so the runtime pool
    // uses the same session/direct URL the bootstrap does (behavior unchanged).
    expect(
      resolveRuntimeDbUrl({
        SUPABASE_DB_URL:
          "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      }),
    ).toBe("postgresql://postgres:postgres@127.0.0.1:54322/postgres");
    expect(
      resolveRuntimeDbUrl({
        POSTGRES_URL_NON_POOLING: "postgresql://direct",
      }),
    ).toBe("postgresql://direct");
    expect(resolveRuntimeDbUrl({})).toBeUndefined();
  });
});

describe("pgConnectionOptions", () => {
  // The exact shape the Vercel<->Supabase integration injects as
  // POSTGRES_URL_NON_POOLING — the URL that broke production with
  // SELF_SIGNED_CERT_IN_CHAIN when pg treated sslmode=require as verify-full.
  const VERCEL_URL =
    "postgres://postgres.ref:pwd@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require&supa=base-pooler.x";

  it("maps the Vercel-injected sslmode=require URL to unverified TLS, stripping the param", () => {
    expect(pgConnectionOptions(VERCEL_URL)).toEqual({
      connectionString:
        "postgres://postgres.ref:pwd@aws-0-us-east-1.pooler.supabase.com:5432/postgres?supa=base-pooler.x",
      ssl: { rejectUnauthorized: false },
    });
  });

  it.each(["allow", "prefer", "require", "no-verify"])(
    "sslmode=%s → encrypted but unverified (libpq semantics)",
    (mode) => {
      const result = pgConnectionOptions(
        `postgresql://u:p@db.ref.supabase.co:5432/postgres?sslmode=${mode}`,
      );
      expect(result.ssl).toEqual({ rejectUnauthorized: false });
      expect(result.connectionString).toBe(
        "postgresql://u:p@db.ref.supabase.co:5432/postgres",
      );
    },
  );

  it("sslmode=disable → ssl off, param stripped", () => {
    expect(
      pgConnectionOptions("postgresql://u:p@db.example.co/db?sslmode=disable"),
    ).toEqual({
      connectionString: "postgresql://u:p@db.example.co/db",
      ssl: false,
    });
  });

  it.each(["verify-ca", "verify-full", "bogus-mode"])(
    "sslmode=%s → full verification (explicit opt-in / fail closed)",
    (mode) => {
      expect(
        pgConnectionOptions(
          `postgresql://u:p@db.example.co/db?sslmode=${mode}`,
        ),
      ).toEqual({
        connectionString: "postgresql://u:p@db.example.co/db",
        ssl: true,
      });
    },
  );

  it("preserves the Payload options param byte-for-byte (no re-encoding)", () => {
    expect(
      pgConnectionOptions(
        "postgresql://payload_cms:pw@db.ref.supabase.co:5432/postgres?options=-c%20search_path%3Dcms&sslmode=require",
      ),
    ).toEqual({
      connectionString:
        "postgresql://payload_cms:pw@db.ref.supabase.co:5432/postgres?options=-c%20search_path%3Dcms",
      ssl: { rejectUnauthorized: false },
    });
  });

  it("strips sslmode in any query position and drops an emptied query", () => {
    expect(
      pgConnectionOptions("postgresql://u:p@h/db?sslmode=require&a=1&b=2")
        .connectionString,
    ).toBe("postgresql://u:p@h/db?a=1&b=2");
    expect(
      pgConnectionOptions("postgresql://u:p@h/db?a=1&sslmode=require&b=2")
        .connectionString,
    ).toBe("postgresql://u:p@h/db?a=1&b=2");
    expect(
      pgConnectionOptions("postgresql://u:p@h/db?sslmode=require")
        .connectionString,
    ).toBe("postgresql://u:p@h/db");
  });

  it("does not re-encode credentials (no URL round-trip)", () => {
    const url =
      "postgresql://payload_cms:p%40ss%2Fw%C3%B6rd@db.ref.supabase.co:5432/postgres?sslmode=require";
    expect(pgConnectionOptions(url).connectionString).toBe(
      "postgresql://payload_cms:p%40ss%2Fw%C3%B6rd@db.ref.supabase.co:5432/postgres",
    );
  });

  it.each(["localhost", "127.0.0.1", "[::1]"])(
    "no sslmode + local host %s → untouched, no ssl override (PGSSLMODE keeps working)",
    (host) => {
      const url = `postgresql://postgres:postgres@${host}:54322/postgres`;
      expect(pgConnectionOptions(url)).toEqual({ connectionString: url });
    },
  );

  it("no sslmode + remote host → encrypted-unverified by default", () => {
    const url = "postgresql://postgres:pw@db.ref.supabase.co:5432/postgres";
    expect(pgConnectionOptions(url)).toEqual({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
    });
  });

  it("passes URLs with advanced ssl params through untouched (pg reads the cert files)", () => {
    for (const url of [
      "postgresql://u:p@h/db?sslrootcert=/etc/supabase-ca.pem&sslmode=verify-full",
      "postgresql://u:p@h/db?uselibpqcompat=true&sslmode=require",
      "postgresql://u:p@h/db?ssl=true",
      "postgresql://u:p@h/db?sslcert=/c.pem&sslkey=/k.pem",
    ]) {
      expect(pgConnectionOptions(url)).toEqual({ connectionString: url });
    }
  });

  it("passes unparseable connection strings through untouched, never throwing", () => {
    for (const value of [
      "host=x port=5432 dbname=postgres",
      "/var/run/postgresql",
      "postgres://a:5432,b:5432/db", // multi-host — not WHATWG-parseable
    ]) {
      expect(pgConnectionOptions(value)).toEqual({ connectionString: value });
    }
  });

  it("returns an empty config for unset input (PAYLOAD_DATABASE_URL is optional)", () => {
    expect(pgConnectionOptions(undefined)).toEqual({});
    expect(pgConnectionOptions("")).toEqual({});
  });
});

describe("summarizeDbError", () => {
  it("extracts the error code and message", () => {
    const error = Object.assign(new Error("self-signed certificate in chain"), {
      code: "SELF_SIGNED_CERT_IN_CHAIN",
    });
    expect(summarizeDbError(error)).toEqual({
      code: "SELF_SIGNED_CERT_IN_CHAIN",
      message: "self-signed certificate in chain",
    });
  });

  it("redacts embedded connection strings (the summary is publicly served)", () => {
    const summary = summarizeDbError(
      new Error(
        "connect failed for postgresql://postgres:s3cret@db.ref.supabase.co:5432/postgres after 3 tries",
      ),
    );
    expect(summary.message).not.toContain("s3cret");
    expect(summary.message).not.toContain("postgresql://");
    expect(summary.message).toContain("[redacted]");
  });

  it("truncates long messages and drops non-string codes", () => {
    const error = Object.assign(new Error("x".repeat(1000)), { code: 42 });
    const summary = summarizeDbError(error);
    expect(summary.message.length).toBeLessThanOrEqual(300);
    expect(summary.code).toBeUndefined();
  });

  it("handles non-Error values", () => {
    expect(summarizeDbError("boom")).toEqual({ message: "boom" });
    expect(summarizeDbError(undefined)).toEqual({ message: "unknown error" });
  });

  it("surfaces the root cause buried in drizzle's wrapper (cause chain)", () => {
    // The shape that hid Supavisor's pool-exhaustion error from the founder:
    // drizzle wraps the real failure as "Failed query: <multi-line SQL>".
    const cause = Object.assign(
      new Error(
        "(EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15",
      ),
      { code: "XX000" },
    );
    const wrapper = new Error(
      'Failed query: SELECT to_regclass(\'"cms"."payload_migrations"\') AS exists;\nparams: ',
      { cause },
    );
    const summary = summarizeDbError(wrapper);
    expect(summary.message).toContain("Failed query: SELECT to_regclass");
    expect(summary.message).toContain(
      "caused by: (EMAXCONNSESSION) max clients reached in session mode",
    );
    // The multi-line query echo is dropped — first line only.
    expect(summary.message).not.toContain("params:");
    expect(summary.code).toBe("XX000");
  });

  it("redacts connection strings anywhere in the cause chain", () => {
    const wrapper = new Error("Failed query: SELECT 1", {
      cause: new Error(
        "connect failed for postgresql://payload_cms:s3cret@db.ref.supabase.co:5432/postgres",
      ),
    });
    const summary = summarizeDbError(wrapper);
    expect(summary.message).not.toContain("s3cret");
    expect(summary.message).toContain("[redacted]");
  });
});

describe("pendingMigrations", () => {
  const bundled = [mig("20260609000001"), mig("20260610000001")];

  it("returns everything for an empty ledger", () => {
    expect(pendingMigrations(bundled, new Set())).toEqual(bundled);
  });

  it("returns only the unapplied tail for a partial ledger", () => {
    expect(pendingMigrations(bundled, new Set(["20260609000001"]))).toEqual([
      bundled[1],
    ]);
  });

  it("returns nothing for a complete ledger", () => {
    expect(
      pendingMigrations(bundled, new Set(["20260609000001", "20260610000001"])),
    ).toEqual([]);
  });

  it("tolerates remote-ahead versions the bundle doesn't know", () => {
    expect(
      pendingMigrations(
        bundled,
        new Set(["20260609000001", "20260610000001", "20270101000000"]),
      ),
    ).toEqual([]);
  });

  it("sorts by version regardless of input order", () => {
    expect(
      pendingMigrations(
        [mig("20260610000001"), mig("20260609000001")],
        new Set(),
      ),
    ).toEqual([mig("20260609000001"), mig("20260610000001")]);
  });
});

describe("parseRoleCredentials", () => {
  it("extracts user + password", () => {
    expect(
      parseRoleCredentials(
        "postgresql://payload_cms:secret@db.example.co:5432/postgres",
      ),
    ).toEqual({ user: "payload_cms", password: "secret" });
  });

  it("decodes percent-encoded credentials and keeps query params out of them", () => {
    expect(
      parseRoleCredentials(
        "postgresql://payload_cms:p%40ss%2Fw%C3%B6rd@127.0.0.1:54322/postgres?options=-c%20search_path%3Dcms",
      ),
    ).toEqual({ user: "payload_cms", password: "p@ss/wörd" });
  });

  it("throws a descriptive error when the password is missing", () => {
    expect(() =>
      parseRoleCredentials("postgresql://payload_cms@127.0.0.1:54322/postgres"),
    ).toThrow(/no password/);
  });

  it("throws on a user-less or malformed URL", () => {
    expect(() =>
      parseRoleCredentials("postgresql://127.0.0.1:54322/postgres"),
    ).toThrow(/no user/);
    expect(() => parseRoleCredentials("not a url")).toThrow(/not a valid/);
  });
});

describe("cmsProvisionStatements", () => {
  const lit = "'s3cret'";

  it("mirrors supabase/payload/00_cms_role.sql statement-for-statement", () => {
    // The SQL file stays the local-dev / SQL-editor source of truth; assert the
    // runtime equivalent covers the same operations.
    const roleSql = readFileSync(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../../../../supabase/payload/00_cms_role.sql",
      ),
      "utf8",
    );
    const statements = cmsProvisionStatements({
      createRole: true,
      passwordLiteral: lit,
    });
    for (const op of [
      "create schema if not exists cms",
      "grant usage, create on schema cms to payload_cms",
      "alter role payload_cms set search_path = cms",
      "revoke all on schema public from payload_cms",
      "revoke all on schema auth from payload_cms",
    ]) {
      expect(
        statements.some((s) => s.includes(op)),
        op,
      ).toBe(true);
      expect(roleSql).toContain(op);
    }
    expect(
      statements.some(
        (s) =>
          s.includes("create role payload_cms with login password 's3cret'") &&
          s.includes("noinherit nocreatedb nocreaterole nosuperuser"),
      ),
    ).toBe(true);
  });

  it("embeds the pre-escaped literal verbatim (quotes stay doubled)", () => {
    const statements = cmsProvisionStatements({
      createRole: true,
      passwordLiteral: "'it''s a $$ secret'",
    });
    expect(
      statements.some((s) => s.includes("password 'it''s a $$ secret'")),
    ).toBe(true);
  });

  it("omits create role when the role already exists", () => {
    const statements = cmsProvisionStatements({
      createRole: false,
      passwordLiteral: lit,
    });
    expect(statements.join("\n")).not.toContain("create role");
    expect(statements.join("\n")).not.toContain("s3cret");
  });

  it("never alters an existing role's password", () => {
    for (const createRole of [true, false]) {
      const joined = cmsProvisionStatements({
        createRole,
        passwordLiteral: lit,
      })
        .join("\n")
        .toLowerCase();
      expect(joined).not.toMatch(/alter role .*password/);
    }
  });
});
