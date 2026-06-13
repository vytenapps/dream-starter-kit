import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BootstrapClient } from "./bootstrap";
import type { SqlMigration } from "./migrations";
import { derivePayloadPassword } from "../cms/derived-credentials";
import { bootstrapDatabase } from "./bootstrap";

// Capture the config `defaultCreateClient` hands to the REAL pg.Client — the
// untested gap that let the hosted-Supabase TLS regression ship (every other
// test injects `createClient`, so the driver config was never exercised).
// The fake answers the inspection as fully provisioned (fast path).
const hoisted = vi.hoisted(() => ({
  pgClientConfigs: [] as unknown[],
  appliedVersions: ["20260609000001", "20260610000001"],
}));

vi.mock("pg", () => {
  class FakePgClient {
    constructor(config: unknown) {
      hoisted.pgClientConfigs.push(config);
    }
    connect() {
      return Promise.resolve();
    }
    query(sql: string) {
      if (sql.includes("to_regclass")) {
        return Promise.resolve({
          rows: [
            { ledger_exists: true, role_exists: true, cms_schema_exists: true },
          ],
        });
      }
      if (sql.includes("select version from supabase_migrations")) {
        return Promise.resolve({
          rows: hoisted.appliedVersions.map((version) => ({ version })),
        });
      }
      return Promise.resolve({ rows: [] });
    }
    end() {
      return Promise.resolve();
    }
    escapeLiteral(v: string) {
      return `'${v}'`;
    }
  }
  return { default: { Client: FakePgClient } };
});

const MIGRATIONS: SqlMigration[] = [
  { version: "20260609000001", name: "initial", sql: "select 'one'" },
  { version: "20260610000001", name: "add_user_tags", sql: "select 'two'" },
];

const ENV = {
  SUPABASE_DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  PAYLOAD_DATABASE_URL:
    "postgresql://payload_cms:realpass@db.example.co:5432/postgres?options=-c%20search_path%3Dcms",
  NODE_ENV: "production",
};

interface FakeDb {
  ledgerExists: boolean;
  applied: string[];
  roleExists: boolean;
  cmsSchemaExists: boolean;
  /** `cms.payload_migrations` exists. */
  cmsLedgerExists: boolean;
  /** Payload migration names recorded in `cms.payload_migrations`. */
  cmsApplied: string[];
}

/** In-memory stand-in for pg.Client, recording every statement. */
function makeFake(db: Partial<FakeDb> = {}, opts: { failOn?: RegExp } = {}) {
  const state: FakeDb = {
    ledgerExists: false,
    applied: [],
    roleExists: false,
    cmsSchemaExists: false,
    cmsLedgerExists: false,
    cmsApplied: [],
    ...db,
  };
  const calls: { sql: string; params?: unknown[] }[] = [];
  let ended = false;
  const client: BootstrapClient = {
    query(sql, params) {
      calls.push({ sql, params });
      if (opts.failOn?.test(sql)) {
        return Promise.reject(new Error(`forced failure on: ${sql}`));
      }
      if (sql.includes("to_regclass")) {
        return Promise.resolve({
          rows: [
            {
              ledger_exists: state.ledgerExists,
              cms_ledger_exists: state.cmsLedgerExists,
              role_exists: state.roleExists,
              cms_schema_exists: state.cmsSchemaExists,
            },
          ],
        });
      }
      if (sql.includes("select name from cms.payload_migrations")) {
        return Promise.resolve({
          rows: state.cmsApplied.map((name) => ({ name })),
        });
      }
      if (sql.includes("select version from supabase_migrations")) {
        return Promise.resolve({
          rows: state.applied.map((version) => ({ version })),
        });
      }
      if (sql.includes("create table if not exists supabase_migrations")) {
        state.ledgerExists = true;
      }
      if (sql.startsWith("insert into supabase_migrations.schema_migrations")) {
        state.applied.push(String(params?.[0]));
      }
      if (sql.includes("create role payload_cms")) state.roleExists = true;
      if (sql.includes("create schema if not exists cms")) {
        state.cmsSchemaExists = true;
      }
      return Promise.resolve({ rows: [] });
    },
    end() {
      ended = true;
      return Promise.resolve();
    },
    escapeLiteral: (v) => `'${v.replaceAll("'", "''")}'`,
  };
  return { client, calls, state, isEnded: () => ended };
}

const spyLogger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });

const run = (
  fake: ReturnType<typeof makeFake>,
  overrides: {
    envSource?: Record<string, string | undefined>;
    logger?: ReturnType<typeof spyLogger>;
  } = {},
) =>
  bootstrapDatabase({
    envSource: overrides.envSource ?? ENV,
    migrations: MIGRATIONS,
    createClient: () => Promise.resolve(fake.client),
    logger: overrides.logger ?? spyLogger(),
  });

describe("bootstrapDatabase gates", () => {
  it.each([
    ["opt-out", { ...ENV, DB_BOOTSTRAP: "off" }],
    ["build-phase", { ...ENV, NEXT_PHASE: "phase-production-build" }],
    ["no-url", { NODE_ENV: "production" }],
  ] as const)(
    "skips with %s without touching the DB",
    async (skipped, envSource) => {
      const createClient = vi.fn();
      const result = await bootstrapDatabase({
        envSource,
        migrations: MIGRATIONS,
        createClient,
        logger: spyLogger(),
      });
      expect(result.skipped).toBe(skipped);
      expect(createClient).not.toHaveBeenCalled();
    },
  );
});

describe("bootstrapDatabase fast path", () => {
  it("skips up-to-date DBs after one inspection, without locking", async () => {
    const fake = makeFake({
      ledgerExists: true,
      applied: MIGRATIONS.map((m) => m.version),
      roleExists: true,
      cmsSchemaExists: true,
    });
    const result = await run(fake);
    expect(result.skipped).toBe("up-to-date");
    expect(fake.calls.some((c) => c.sql.includes("pg_advisory_lock"))).toBe(
      false,
    );
    expect(fake.isEnded()).toBe(true);
  });
});

describe("bootstrapDatabase full provisioning", () => {
  it("locks, applies migrations transactionally, provisions cms, backfills, unlocks", async () => {
    const fake = makeFake();
    const result = await run(fake);

    expect(result).toEqual({
      skipped: false,
      appliedVersions: MIGRATIONS.map((m) => m.version),
      cmsRoleCreated: true,
      cmsWarmed: false,
    });

    const sqls = fake.calls.map((c) => c.sql);
    const idx = (re: RegExp) => sqls.findIndex((s) => re.test(s));

    // Lock before any write; ledger ensured before the first migration.
    expect(idx(/pg_advisory_lock/)).toBeGreaterThan(-1);
    expect(idx(/pg_advisory_lock/)).toBeLessThan(idx(/^begin$/));
    expect(idx(/create table if not exists supabase_migrations/)).toBeLessThan(
      idx(/^begin$/),
    );

    // Each migration: begin → sql → ledger insert (whole file as statements[0]) → commit.
    for (const m of MIGRATIONS) {
      const at = sqls.indexOf(m.sql);
      expect(at).toBeGreaterThan(-1);
      expect(sqls[at - 1]).toBe("begin");
      const insert = fake.calls[at + 1];
      expect(insert?.sql).toContain(
        "insert into supabase_migrations.schema_migrations",
      );
      expect(insert?.params).toEqual([m.version, m.name, [m.sql]]);
      expect(sqls[at + 2]).toBe("commit");
    }

    // cms provisioning with the password from PAYLOAD_DATABASE_URL.
    expect(
      sqls.some((s) =>
        s.includes("create role payload_cms with login password 'realpass'"),
      ),
    ).toBe(true);
    expect(sqls.some((s) => s.includes("revoke all on schema auth"))).toBe(
      true,
    );

    // Profile backfill + founder flag, in one transaction.
    const backfill = idx(/insert into public\.profiles/);
    const founder = idx(/set is_staff = true/);
    expect(backfill).toBeGreaterThan(-1);
    expect(founder).toBeGreaterThan(backfill);

    // Cleanup always runs.
    expect(idx(/pg_advisory_unlock/)).toBeGreaterThan(founder);
    expect(fake.isEnded()).toBe(true);
  });

  it("re-checks inside the lock and applies nothing when another instance won", async () => {
    // First inspection (fast path) sees an empty ledger; the in-lock one sees
    // everything applied — as if a concurrent cold boot finished in between.
    const fake = makeFake({ roleExists: true, cmsSchemaExists: true });
    let versionReads = 0;
    const inner = fake.client.query.bind(fake.client);
    fake.client.query = (sql, params) => {
      if (sql.includes("to_regclass")) fake.state.ledgerExists = true;
      if (sql.includes("select version from supabase_migrations")) {
        versionReads += 1;
        if (versionReads > 1) {
          fake.state.applied = MIGRATIONS.map((m) => m.version);
        }
      }
      return inner(sql, params);
    };
    const result = await run(fake);
    expect(result.appliedVersions).toEqual([]);
    expect(fake.calls.map((c) => c.sql)).not.toContain("select 'one'");
  });
});

describe("bootstrapDatabase CMS migrate under the lock", () => {
  // The fix for the fresh-deploy /welcome 500: Payload's prodMigrations run via
  // migrateCms INSIDE the advisory lock, never concurrently / at request time.
  const runWith = (
    fake: ReturnType<typeof makeFake>,
    deps: { migrateCms?: () => Promise<void>; cmsMigrationNames?: string[] },
  ) =>
    bootstrapDatabase({
      envSource: ENV,
      migrations: MIGRATIONS,
      createClient: () => Promise.resolve(fake.client),
      logger: spyLogger(),
      ...deps,
    });

  it("runs migrateCms while holding the lock on a fresh DB", async () => {
    const fake = makeFake(); // nothing provisioned yet
    let sqlsAtCall: string[] = [];
    const migrateCms = vi.fn(() => {
      sqlsAtCall = fake.calls.map((c) => c.sql);
      return Promise.resolve();
    });

    const result = await runWith(fake, {
      migrateCms,
      cmsMigrationNames: ["20260609_initial"],
    });

    expect(migrateCms).toHaveBeenCalledTimes(1);
    expect(result.cmsWarmed).toBe(true);
    // Called after the lock was taken, before it was released.
    expect(sqlsAtCall.some((s) => s.includes("pg_advisory_lock"))).toBe(true);
    expect(sqlsAtCall.some((s) => s.includes("pg_advisory_unlock"))).toBe(
      false,
    );
  });

  it("fast-paths (no lock, no migrateCms) once the CMS ledger is complete", async () => {
    const fake = makeFake({
      ledgerExists: true,
      applied: MIGRATIONS.map((m) => m.version),
      roleExists: true,
      cmsSchemaExists: true,
      cmsLedgerExists: true,
      cmsApplied: ["20260609_initial"],
    });
    const migrateCms = vi.fn(() => Promise.resolve());

    const result = await runWith(fake, {
      migrateCms,
      cmsMigrationNames: ["20260609_initial"],
    });

    expect(result.skipped).toBe("up-to-date");
    expect(result.cmsWarmed).toBe(false);
    expect(migrateCms).not.toHaveBeenCalled();
    expect(fake.calls.some((c) => c.sql.includes("pg_advisory_lock"))).toBe(
      false,
    );
  });

  it("takes the lock for a CMS migration added to an already-provisioned DB", async () => {
    // supabase migrations done + role/schema exist, but a NEW Payload migration
    // is bundled that the cms ledger doesn't have yet — must not fast-path.
    const fake = makeFake({
      ledgerExists: true,
      applied: MIGRATIONS.map((m) => m.version),
      roleExists: true,
      cmsSchemaExists: true,
      cmsLedgerExists: true,
      cmsApplied: ["20260609_initial"],
    });
    const migrateCms = vi.fn(() => Promise.resolve());

    const result = await runWith(fake, {
      migrateCms,
      cmsMigrationNames: ["20260609_initial", "20260613_new_feature"],
    });

    expect(result.skipped).toBe(false);
    expect(result.cmsWarmed).toBe(true);
    expect(migrateCms).toHaveBeenCalledTimes(1);
    expect(fake.calls.some((c) => c.sql.includes("pg_advisory_lock"))).toBe(
      true,
    );
  });
});

describe("defaultCreateClient pg config (hosted-Supabase TLS regression)", () => {
  beforeEach(() => {
    hoisted.pgClientConfigs.length = 0;
  });

  // Run WITHOUT `createClient` so the default path constructs the (mocked)
  // real pg.Client.
  const runDefault = (supabaseDbUrl: string) =>
    bootstrapDatabase({
      envSource: { ...ENV, SUPABASE_DB_URL: supabaseDbUrl },
      migrations: MIGRATIONS,
      logger: spyLogger(),
    });

  it("strips sslmode=require and connects encrypted-unverified (Vercel<->Supabase URL)", async () => {
    const result = await runDefault(
      "postgres://postgres.ref:pwd@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require&supa=base-pooler.x",
    );
    // up-to-date proves defaultCreateClient really is on the default path —
    // the run went through the mocked driver's inspection round.
    expect(result.skipped).toBe("up-to-date");
    expect(hoisted.pgClientConfigs).toEqual([
      {
        connectionString:
          "postgres://postgres.ref:pwd@aws-0-us-east-1.pooler.supabase.com:5432/postgres?supa=base-pooler.x",
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10_000,
      },
    ]);
  });

  it("leaves local plaintext URLs untouched, with no ssl override", async () => {
    await runDefault(ENV.SUPABASE_DB_URL);
    expect(hoisted.pgClientConfigs).toEqual([
      {
        connectionString: ENV.SUPABASE_DB_URL,
        connectionTimeoutMillis: 10_000,
      },
    ]);
    expect(hoisted.pgClientConfigs[0]).not.toHaveProperty("ssl");
  });

  it("keeps full verification when the URL opts into verify-full", async () => {
    await runDefault(
      "postgresql://postgres:pwd@db.ref.supabase.co:5432/postgres?sslmode=verify-full",
    );
    expect(hoisted.pgClientConfigs[0]).toMatchObject({ ssl: true });
  });
});

describe("bootstrapDatabase failure handling", () => {
  it("rolls back the failing migration, stops, and still unlocks — without throwing", async () => {
    const logger = spyLogger();
    const fake = makeFake({}, { failOn: /select 'two'/ });
    const result = await run(fake, { logger });

    expect(result.skipped).toBe(false);
    expect(result.appliedVersions).toEqual(["20260609000001"]);
    expect(result.cmsRoleCreated).toBe(false);

    const sqls = fake.calls.map((c) => c.sql);
    expect(sqls).toContain("rollback");
    // Provisioning after the failure point is not attempted this boot.
    expect(sqls.some((s) => s.includes("create role payload_cms"))).toBe(false);
    expect(sqls.some((s) => s.includes("pg_advisory_unlock"))).toBe(true);
    expect(fake.isEnded()).toBe(true);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("20260610000001_add_user_tags failed"),
      expect.any(Error),
    );
  });

  it("never creates the role with the dev password in production", async () => {
    const logger = spyLogger();
    const fake = makeFake();
    const result = await run(fake, {
      logger,
      envSource: {
        ...ENV,
        PAYLOAD_DATABASE_URL:
          "postgresql://payload_cms:payload_local_dev_only@db.example.co:5432/postgres",
      },
    });
    expect(result.cmsRoleCreated).toBe(false);
    expect(
      fake.calls.some((c) => c.sql.includes("create role payload_cms")),
    ).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("refusing"),
    );
    // Migrations still applied — only the role creation is refused.
    expect(result.appliedVersions).toEqual(MIGRATIONS.map((m) => m.version));
  });

  it("allows the dev password outside production (local stack)", async () => {
    const fake = makeFake();
    const result = await run(fake, {
      envSource: {
        ...ENV,
        NODE_ENV: "development",
        PAYLOAD_DATABASE_URL:
          "postgresql://payload_cms:payload_local_dev_only@127.0.0.1:54322/postgres",
      },
    });
    expect(result.cmsRoleCreated).toBe(true);
  });

  it("derives the cms credentials from the service-role key when PAYLOAD_DATABASE_URL is unset", async () => {
    const logger = spyLogger();
    const fake = makeFake();
    const seed = "sb_secret_test_service_role_key";
    const result = await run(fake, {
      logger,
      envSource: {
        SUPABASE_DB_URL: ENV.SUPABASE_DB_URL,
        SUPABASE_SERVICE_ROLE_KEY: seed,
        NODE_ENV: "production",
      },
    });
    expect(result.cmsRoleCreated).toBe(true);
    // The created password must be EXACTLY the derivation payload.config.ts
    // uses for its pool — that contract is what makes zero-touch work.
    const expectedPassword = derivePayloadPassword(seed);
    expect(
      fake.calls.some((c) =>
        c.sql.includes(
          `create role payload_cms with login password '${expectedPassword}'`,
        ),
      ),
    ).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("derived from SUPABASE_SERVICE_ROLE_KEY"),
    );
  });

  it("still skips cms provisioning when neither PAYLOAD_DATABASE_URL nor the seed exists", async () => {
    const logger = spyLogger();
    const fake = makeFake();
    const result = await run(fake, {
      logger,
      envSource: {
        SUPABASE_DB_URL: ENV.SUPABASE_DB_URL,
        NODE_ENV: "production",
      },
    });
    expect(result.cmsRoleCreated).toBe(false);
    expect(
      fake.calls.some((c) => c.sql.includes("create role payload_cms")),
    ).toBe(false);
    // Migrations still applied — only cms provisioning is skipped.
    expect(result.appliedVersions).toEqual(MIGRATIONS.map((m) => m.version));
  });

  it("provisions for an explicit pooler-style URL (tenant-suffixed username)", async () => {
    const fake = makeFake();
    const result = await run(fake, {
      envSource: {
        ...ENV,
        PAYLOAD_DATABASE_URL:
          "postgres://payload_cms.abcdefgh:realpass@aws-0-us-east-1.pooler.supabase.com:5432/postgres?options=-c%20search_path%3Dcms",
      },
    });
    expect(result.cmsRoleCreated).toBe(true);
    expect(
      fake.calls.some((c) =>
        c.sql.includes(
          "create role payload_cms with login password 'realpass'",
        ),
      ),
    ).toBe(true);
  });

  it("re-grants but never re-creates (or re-passwords) an existing role", async () => {
    const fake = makeFake({ roleExists: true });
    const result = await run(fake);
    expect(result.cmsRoleCreated).toBe(false);
    const joined = fake.calls.map((c) => c.sql).join("\n");
    expect(joined).toContain("grant usage, create on schema cms");
    expect(joined).not.toContain("create role");
    expect(joined).not.toContain("realpass");
  });

  it("resolves (never throws) when the connection itself fails", async () => {
    const logger = spyLogger();
    const result = await bootstrapDatabase({
      envSource: ENV,
      migrations: MIGRATIONS,
      createClient: () => Promise.reject(new Error("ECONNREFUSED")),
      logger,
    });
    expect(result.skipped).toBe("error");
    expect(logger.error).toHaveBeenCalled();
  });

  it("attaches a sanitized error summary — code kept, connection string redacted", async () => {
    const tlsError = Object.assign(
      new Error(
        "self-signed certificate in certificate chain (connecting to postgresql://postgres:s3cret@db.ref.supabase.co:5432/postgres)",
      ),
      { code: "SELF_SIGNED_CERT_IN_CHAIN" },
    );
    const result = await bootstrapDatabase({
      envSource: ENV,
      migrations: MIGRATIONS,
      createClient: () => Promise.reject(tlsError),
      logger: spyLogger(),
    });
    expect(result.error?.code).toBe("SELF_SIGNED_CERT_IN_CHAIN");
    // The summary feeds the PUBLIC /api/health/db endpoint.
    const serialized = JSON.stringify(result.error);
    expect(serialized).not.toContain("s3cret");
    expect(serialized).not.toContain("postgresql://");
  });

  it("attaches the error summary on a mid-run migration failure too", async () => {
    const fake = makeFake({}, { failOn: /select 'two'/ });
    const result = await run(fake);
    expect(result.skipped).toBe(false);
    expect(result.error?.message).toContain("forced failure");
  });
});
