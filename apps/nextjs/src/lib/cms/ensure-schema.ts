import type { Migration, Payload } from "payload";

import { migrations } from "../../payload/migrations";
import { pgConnectionOptions } from "../db/bootstrap-core";
import { resolveCmsCredentials } from "./derived-credentials";
import { withCmsInitLock } from "./init-lock";

/**
 * Request-time self-heal for a missing `cms` schema.
 *
 * Payload only provisions its tables at server BOOT: dev "push" runs once at
 * init, and `prodMigrations` run once on first connect. If the database is
 * reset while the server is running (`supabase db reset` instead of
 * `pnpm db:reset`, which chains `cms:migrate`) — or the server booted while
 * Postgres was down — every CMS query fails with Postgres `42P01`
 * (undefined_table) until someone runs `pnpm cms:migrate` by hand. That
 * stranded the first-login flow: /welcome → /cms-setup → /admin all sit on
 * `cms.users`.
 *
 * `withCmsSchemaHeal` wraps the first CMS query of those flows: on `42P01` it
 * applies the committed Payload migrations in-process (same set as
 * `prodMigrations`) and retries once. Healing is guarded so it can never run
 * `migrate()` against a half-provisioned schema:
 *
 *   - only when `cms.users` AND the `cms.payload_migrations` ledger are BOTH
 *     absent (a truly fresh/wiped schema). A ledger with a dev-push record
 *     would make the adapter's `migrate()` prompt interactively — and
 *     `process.exit(0)` the server on a closed stdin — so that state aborts
 *     with a loud log instead;
 *   - under the same cross-instance advisory lock as the boot warm-up
 *     (lib/cms/init-lock.ts), so concurrent requests/instances don't race;
 *   - one heal in flight per process; failures rethrow the original error.
 */

/** The slice of `pg.Client` the schema check uses — fakeable in unit tests. */
export interface SchemaCheckClient {
  query(sql: string): Promise<{ rows: Record<string, unknown>[] }>;
  end(): Promise<void>;
}

export interface CmsSchemaHealDeps {
  /** Connection factory — defaults to a real `pg.Client`. */
  createClient?: (connectionString: string) => Promise<SchemaCheckClient>;
  /** CMS connection string — defaults to the resolved (explicit or derived) one. */
  databaseUrl?: string;
  logger?: Pick<Console, "info" | "warn" | "error">;
  /** Migration runner — defaults to `payload.db.migrate` with the committed set. */
  migrate?: (payload: Payload) => Promise<void>;
}

/** True when the error chain contains Postgres 42P01 (undefined_table). */
export function isMissingCmsTablesError(error: unknown): boolean {
  for (let e: unknown = error; e instanceof Error; e = e.cause) {
    if ((e as { code?: unknown }).code === "42P01") return true;
  }
  return false;
}

async function defaultCreateClient(
  connectionString: string,
): Promise<SchemaCheckClient> {
  const { default: pg } = await import("pg");
  const client = new pg.Client({
    ...pgConnectionOptions(connectionString),
    connectionTimeoutMillis: 10_000,
  });
  await client.connect();
  return client;
}

function defaultMigrate(payload: Payload): Promise<void> {
  // The adapter runs these with MigrateUpArgs/MigrateDownArgs — the same shape
  // its `prodMigrations` option takes; the base `migrate()` signature just
  // erases the args to `unknown`, hence the cast.
  return payload.db.migrate({ migrations: migrations as Migration[] });
}

const CHECK_SQL = `select
  to_regclass('cms.users') is not null as users_exists,
  to_regclass('cms.payload_migrations') is not null as ledger_exists`;

async function runHeal(
  payload: Payload,
  deps: CmsSchemaHealDeps,
): Promise<boolean> {
  const log = deps.logger ?? console;
  const databaseUrl = deps.databaseUrl ?? resolveCmsCredentials().databaseUrl;
  if (!databaseUrl) return false; // CMS not configured — nothing to heal.

  return withCmsInitLock(
    async () => {
      let usersExists: boolean;
      let ledgerExists: boolean;
      let client: SchemaCheckClient | undefined;
      try {
        client = await (deps.createClient ?? defaultCreateClient)(databaseUrl);
        const { rows } = await client.query(CHECK_SQL);
        usersExists = Boolean(rows[0]?.users_exists);
        ledgerExists = Boolean(rows[0]?.ledger_exists);
      } catch (error) {
        log.warn(
          "[cms-heal] could not inspect the cms schema — skipping self-heal",
          error,
        );
        return false;
      } finally {
        await client?.end().catch(() => undefined);
      }

      if (usersExists) return true; // Another request/instance healed first.
      if (ledgerExists) {
        log.error(
          "[cms-heal] cms.payload_migrations exists but cms.users is missing — partially provisioned schema; not auto-migrating. Run `pnpm cms:migrate` (or `pnpm db:reset`) manually.",
        );
        return false;
      }

      log.warn(
        "[cms-heal] cms tables are missing (database reset since boot? `supabase db reset` without `pnpm db:reset`?) — applying the committed Payload migrations",
      );
      try {
        await (deps.migrate ?? defaultMigrate)(payload);
        log.warn("[cms-heal] cms schema healed — Payload migrations applied");
        return true;
      } catch (error) {
        log.error(
          "[cms-heal] applying Payload migrations failed — run `pnpm cms:migrate` manually",
          error,
        );
        return false;
      }
    },
    // The check client satisfies the lock's client shape — one injected
    // factory serves both connections in tests.
    { createClient: deps.createClient, databaseUrl, logger: log },
  );
}

let healing: Promise<boolean> | null = null;

/**
 * Apply the committed Payload migrations if (and only if) the cms schema is
 * empty. Concurrent callers share one in-flight heal; resolves `true` when the
 * schema exists afterwards (healed here or by another instance).
 */
export function healCmsSchema(
  payload: Payload,
  deps: CmsSchemaHealDeps = {},
): Promise<boolean> {
  healing ??= runHeal(payload, deps).finally(() => {
    healing = null;
  });
  return healing;
}

/**
 * Run a CMS query, self-healing a missing cms schema on Postgres 42P01 and
 * retrying once. Any other failure — or a heal that didn't restore the schema
 * — rethrows the original error.
 */
export async function withCmsSchemaHeal<T>(
  payload: Payload,
  fn: () => Promise<T>,
  deps: CmsSchemaHealDeps = {},
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!isMissingCmsTablesError(error)) throw error;
    if (!(await healCmsSchema(payload, deps))) throw error;
    return fn();
  }
}
