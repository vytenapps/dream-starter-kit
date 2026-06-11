import { describe, expect, it, vi } from "vitest";

import type { BootstrapClient } from "./bootstrap";
import type { SqlMigration } from "./migrations";
import { bootstrapDatabase } from "./bootstrap";

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
}

/** In-memory stand-in for pg.Client, recording every statement. */
function makeFake(db: Partial<FakeDb> = {}, opts: { failOn?: RegExp } = {}) {
  const state: FakeDb = {
    ledgerExists: false,
    applied: [],
    roleExists: false,
    cmsSchemaExists: false,
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
              role_exists: state.roleExists,
              cms_schema_exists: state.cmsSchemaExists,
            },
          ],
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
});
