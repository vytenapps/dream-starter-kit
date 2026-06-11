import { pgConnectionOptions } from "../db/bootstrap-core";
import { resolveCmsCredentials } from "./derived-credentials";

/**
 * Cross-instance lock for Payload's FIRST initialization. On serverless,
 * several lambdas cold-boot at once and each `getPayload()` runs the adapter's
 * `createExtensions` (CREATE EXTENSION postgis) and `prodMigrations` — neither
 * is concurrency-safe across instances. On a fresh hosted deploy that
 * stampede produced "duplicate key value violates unique constraint
 * pg_extension_name_index", duplicate CREATE TYPE failures, and a burst of
 * connections that exhausted Supavisor's session-mode pool.
 *
 * The lock is a Postgres session advisory lock held on a dedicated,
 * short-lived connection for the duration of the warm-up: the first instance
 * migrates while the rest wait, then find the ledger up to date and no-op.
 * Best-effort by design — if the lock connection can't be made (CMS not
 * configured, pool exhausted), the warm-up proceeds unlocked, which is
 * exactly today's behavior.
 */
const INIT_LOCK_KEY = "dream-starter-kit:payload-init";

/** The slice of `pg.Client` the lock uses — fakeable in unit tests. */
export interface LockClient {
  query(sql: string, params?: unknown[]): Promise<unknown>;
  end(): Promise<void>;
}

export interface CmsInitLockDeps {
  /** Connection factory — defaults to a real `pg.Client`. */
  createClient?: (connectionString: string) => Promise<LockClient>;
  /** CMS connection string — defaults to the resolved (explicit or derived) one. */
  databaseUrl?: string;
  logger?: Pick<Console, "warn">;
}

async function defaultCreateClient(
  connectionString: string,
): Promise<LockClient> {
  const { default: pg } = await import("pg");
  const client = new pg.Client({
    ...pgConnectionOptions(connectionString),
    connectionTimeoutMillis: 10_000,
  });
  await client.connect();
  return client;
}

export async function withCmsInitLock<T>(
  fn: () => Promise<T>,
  deps: CmsInitLockDeps = {},
): Promise<T> {
  const log = deps.logger ?? console;
  const databaseUrl = deps.databaseUrl ?? resolveCmsCredentials().databaseUrl;

  let client: LockClient | undefined;
  if (databaseUrl) {
    try {
      client = await (deps.createClient ?? defaultCreateClient)(databaseUrl);
      await client.query(`select pg_advisory_lock(hashtext($1)::bigint)`, [
        INIT_LOCK_KEY,
      ]);
    } catch (error) {
      log.warn(
        "[cms-init] couldn't take the cross-instance init lock — proceeding unlocked",
        error,
      );
      await client?.end().catch(() => undefined);
      client = undefined;
    }
  }

  try {
    return await fn();
  } finally {
    if (client) {
      await client
        .query(`select pg_advisory_unlock(hashtext($1)::bigint)`, [
          INIT_LOCK_KEY,
        ])
        .catch(() => undefined);
      await client.end().catch(() => undefined);
    }
  }
}
