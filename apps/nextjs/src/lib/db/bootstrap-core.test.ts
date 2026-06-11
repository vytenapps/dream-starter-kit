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
  resolveAdminDbUrl,
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

  it("never considers the pooled POSTGRES_URL", () => {
    expect(
      resolveAdminDbUrl({ POSTGRES_URL: "postgresql://pooled" }),
    ).toBeUndefined();
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
