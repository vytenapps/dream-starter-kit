/**
 * Runtime DB bootstrap — makes a fresh hosted Supabase project self-provision
 * on first server boot, so deploying the kit needs NO manual `supabase db push`
 * or SQL-editor steps.
 *
 * Called via lib/db/bootstrap-runner.ts — at server boot (instrumentation.ts)
 * and again from request paths when the boot attempt failed (the runner's
 * `ensureDbProvisioned`). In order, under one lock:
 *
 *   1. applies pending `supabase/migrations/*.sql` (bundled by
 *      `pnpm db:gen-migrations`) against the privileged session-mode connection,
 *      recording them in the SAME ledger the Supabase CLI uses
 *      (`supabase_migrations.schema_migrations`) — so the bootstrap and a manual
 *      `supabase db push` stay interchangeable, in either order;
 *   2. provisions the `cms` schema + least-privilege `payload_cms` role
 *      (mirroring supabase/payload/00_cms_role.sql; password from
 *      PAYLOAD_DATABASE_URL, or derived from SUPABASE_SERVICE_ROLE_KEY when
 *      unset — see lib/cms/derived-credentials);
 *   3. backfills `public.profiles` for accounts created before the trigger
 *      existed, flagging the earliest signup as the founder;
 *   4. runs Payload's `prodMigrations` + extension reconcile via the injected
 *      `migrateCms` callback — STILL HOLDING THE LOCK, so the CMS migration is
 *      serialized across cold-starting instances and never runs at request
 *      time (a failed Payload migration calls `process.exit(1)`, which a
 *      concurrent run would otherwise trigger and surface as a Vercel
 *      FUNCTION_INVOCATION_FAILED 500). See BootstrapDeps#migrateCms.
 *
 * Concurrency-safe (session advisory lock + re-check inside it) and idempotent
 * (a fully-provisioned, fully-migrated DB short-circuits on one cheap
 * inspection round — no lock, and the caller warms Payload unlocked since no
 * migration is pending). It NEVER throws: any failure logs `[db-bootstrap]`
 * loudly and lets the boot continue, degrading to the manual provisioning flow
 * documented in the README.
 */
import type { SqlMigration } from "./migrations";
import { env } from "../../env";
import { resolveCmsCredentials } from "../cms/derived-credentials";
import {
  BOOTSTRAP_LOCK_KEY,
  CMS_ROLE,
  cmsProvisionStatements,
  DEV_PAYLOAD_PASSWORD,
  ENSURE_LEDGER_SQL,
  FOUNDER_FLAG_SQL,
  parseRoleCredentials,
  pendingMigrations,
  pgConnectionOptions,
  PROFILE_BACKFILL_SQL,
  resolveAdminDbUrl,
  summarizeDbError,
} from "./bootstrap-core";
import { recordBootstrapResult } from "./bootstrap-status";
import { supabaseMigrations } from "./migrations";

/** The slice of `pg.Client` the runner uses — fakeable in unit tests. */
export interface BootstrapClient {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
  end(): Promise<void>;
  escapeLiteral(value: string): string;
}

export interface BootstrapDeps {
  /** Env snapshot — defaults to the validated app env (+ NEXT_PHASE). */
  envSource?: Record<string, string | undefined>;
  /** Migrations to apply — defaults to the bundled, committed set. */
  migrations?: SqlMigration[];
  /** Connection factory — defaults to a real `pg.Client`. */
  createClient?: (connectionString: string) => Promise<BootstrapClient>;
  logger?: Pick<Console, "info" | "warn" | "error">;
  /**
   * Bundled Payload (`cms`) migration NAMES. Lets the bootstrap detect a
   * pending CMS migration — on a fresh DB, or after a deploy adds one to an
   * already-provisioned DB — and run it under the lock via `migrateCms`.
   * Omitted ⇒ CMS migration state is not tracked (the bootstrap only
   * provisions the schema/role; Payload migrates itself later, unlocked).
   */
  cmsMigrationNames?: string[];
  /**
   * Warms Payload — `getPayload()` runs its `prodMigrations` on first connect —
   * and reconciles the extension registry/menu. Invoked once, INSIDE the
   * bootstrap's cross-instance advisory lock (on the reliable session
   * connection), so the first-boot CMS migration is serialized across cold-
   * starting instances and never runs at request time. That matters because a
   * failed Payload migration calls `process.exit(1)` (uncatchable): under
   * concurrent cold starts two instances run the same migration, the loser
   * hits a duplicate "already exists" and exits, which Vercel surfaces as a
   * `FUNCTION_INVOCATION_FAILED` 500 on whatever request that lambda was
   * serving (e.g. `/welcome`). Injected from instrumentation so this module
   * stays Payload-free.
   */
  migrateCms?: () => Promise<void>;
  /** Delay between connect retries — injectable so tests don't wait. */
  sleep?: (ms: number) => Promise<void>;
}

export interface BootstrapResult {
  /** Why nothing ran — or `false` when provisioning work was attempted. */
  skipped:
    | "opt-out"
    | "build-phase"
    | "no-url"
    | "up-to-date"
    | "error"
    | false;
  appliedVersions: string[];
  cmsRoleCreated: boolean;
  /** Whether `migrateCms` ran here (under the lock). When false on a non-error
   * result, the caller is responsible for warming Payload itself (unlocked is
   * safe — the fast path only short-circuits once nothing is pending). */
  cmsWarmed: boolean;
  /** Sanitized failure summary (set on connect/migration errors) — safe for
   * the public /api/health/db endpoint; never contains the connection string. */
  error?: { code?: string; message: string };
}

interface DbState {
  roleExists: boolean;
  cmsSchemaExists: boolean;
  applied: Set<string>;
  pending: SqlMigration[];
  /** Bundled Payload migration names not yet in `cms.payload_migrations`.
   * Empty when `cmsMigrationNames` was not supplied (CMS state untracked). */
  pendingCms: string[];
}

async function defaultCreateClient(
  connectionString: string,
): Promise<BootstrapClient> {
  // Dynamic so the driver is only loaded once the gates have passed (and so
  // DB-less boots / the edge pass never touch it).
  const { default: pg } = await import("pg");
  // pgConnectionOptions strips `sslmode` from the URL and supplies the ssl
  // option itself (libpq semantics): pg merges the PARSED url over explicit
  // config, so hosted Supabase's `sslmode=require` would otherwise force full
  // chain verification against Supabase's self-rooted CA and fail with
  // SELF_SIGNED_CERT_IN_CHAIN.
  const client = new pg.Client({
    ...pgConnectionOptions(connectionString),
    connectionTimeoutMillis: 10_000,
  });
  await client.connect();
  return client;
}

/**
 * Connect retry policy. A one-click deploy connects the Supabase integration
 * and redeploys while the brand-new project is still provisioning — the very
 * first connect attempt can hit a database/pooler that isn't accepting
 * connections yet. A single failed attempt used to abort provisioning for the
 * whole life of the instance, and the un-provisioned `payload_cms` role then
 * poisoned later attempts (see lib/cms/payload-client.ts), so the founder's
 * first sign-up died on /welcome. Three spaced attempts ride out that window.
 */
const CONNECT_ATTEMPTS = 3;
const CONNECT_RETRY_DELAYS_MS = [2_000, 4_000];

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function connectWithRetry(
  createClient: (connectionString: string) => Promise<BootstrapClient>,
  connectionString: string,
  log: Pick<Console, "info" | "warn" | "error">,
  sleep: (ms: number) => Promise<void>,
): Promise<BootstrapClient> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await createClient(connectionString);
    } catch (error) {
      if (attempt >= CONNECT_ATTEMPTS) throw error;
      const delay =
        CONNECT_RETRY_DELAYS_MS[attempt - 1] ??
        CONNECT_RETRY_DELAYS_MS[CONNECT_RETRY_DELAYS_MS.length - 1] ??
        2_000;
      log.warn(
        `[db-bootstrap] connect attempt ${attempt}/${CONNECT_ATTEMPTS} failed (${summarizeDbError(error).message}) — retrying in ${Math.round(delay / 1000)}s (a just-created Supabase project can take a moment to accept connections)`,
      );
      await sleep(delay);
    }
  }
}

async function inspectState(
  client: BootstrapClient,
  migrations: SqlMigration[],
  cmsMigrationNames?: string[],
): Promise<DbState> {
  const flags = await client.query(
    `select
       to_regclass('supabase_migrations.schema_migrations') is not null as ledger_exists,
       to_regclass('cms.payload_migrations') is not null as cms_ledger_exists,
       exists (select 1 from pg_roles where rolname = $1) as role_exists,
       exists (select 1 from information_schema.schemata where schema_name = 'cms') as cms_schema_exists`,
    [CMS_ROLE],
  );
  const row = flags.rows[0] ?? {};
  let applied = new Set<string>();
  if (row.ledger_exists) {
    const versions = await client.query(
      `select version from supabase_migrations.schema_migrations`,
    );
    applied = new Set(versions.rows.map((r) => String(r.version)));
  }

  // Pending Payload migrations: only computed when names are supplied. When the
  // cms.payload_migrations ledger doesn't exist yet (fresh DB), every bundled
  // migration is pending; otherwise it's the bundled names not yet recorded.
  let pendingCms: string[] = [];
  if (cmsMigrationNames && cmsMigrationNames.length > 0) {
    if (row.cms_ledger_exists) {
      const ran = await client.query(`select name from cms.payload_migrations`);
      const have = new Set(ran.rows.map((r) => String(r.name)));
      pendingCms = cmsMigrationNames.filter((name) => !have.has(name));
    } else {
      pendingCms = [...cmsMigrationNames];
    }
  }

  return {
    roleExists: Boolean(row.role_exists),
    cmsSchemaExists: Boolean(row.cms_schema_exists),
    applied,
    pending: pendingMigrations(migrations, applied),
    pendingCms,
  };
}

/**
 * Mirrors supabase/payload/00_cms_role.sql at runtime. Create-only: an
 * existing role's password is never altered. Returns whether the role was
 * created on this run.
 */
async function provisionCms(
  client: BootstrapClient,
  envSource: Record<string, string | undefined>,
  roleExists: boolean,
  log: Pick<Console, "info" | "warn" | "error">,
): Promise<boolean> {
  // Explicit PAYLOAD_DATABASE_URL wins; otherwise the credentials are derived
  // from SUPABASE_SERVICE_ROLE_KEY + the admin URL (zero-touch deploys) — the
  // SAME derivation payload.config.ts uses for its pool, so the role created
  // here matches what Payload connects with.
  const { databaseUrl: payloadUrl, derived } = resolveCmsCredentials(envSource);
  if (!payloadUrl) {
    log.info(
      "[db-bootstrap] PAYLOAD_DATABASE_URL unset and not derivable (needs SUPABASE_SERVICE_ROLE_KEY) — skipping cms schema/role provisioning",
    );
    return false;
  }
  const creds = parseRoleCredentials(payloadUrl);
  // Supavisor pooler URLs address the project via a username suffix
  // (`payload_cms.<ref>`) — the Postgres ROLE name is the part before the dot.
  const roleName = creds.user.split(".")[0];
  if (roleName !== CMS_ROLE) {
    log.info(
      `[db-bootstrap] PAYLOAD_DATABASE_URL connects as "${creds.user}", not "${CMS_ROLE}" — assuming a custom role you manage; skipping`,
    );
    return false;
  }
  if (
    !roleExists &&
    creds.password === DEV_PAYLOAD_PASSWORD &&
    envSource.NODE_ENV === "production"
  ) {
    log.error(
      `[db-bootstrap] refusing to create the ${CMS_ROLE} role with the local dev password in production — set a real password in PAYLOAD_DATABASE_URL`,
    );
    return false;
  }
  const statements = cmsProvisionStatements({
    createRole: !roleExists,
    passwordLiteral: client.escapeLiteral(creds.password),
  });
  for (const sql of statements) {
    await client.query(sql);
  }
  if (!roleExists) {
    log.info(
      `[db-bootstrap] created the ${CMS_ROLE} role + cms schema${
        derived.databaseUrl
          ? " (credentials derived from SUPABASE_SERVICE_ROLE_KEY)"
          : ""
      }`,
    );
  }
  return !roleExists;
}

export async function bootstrapDatabase(
  deps: BootstrapDeps = {},
): Promise<BootstrapResult> {
  const result = await runBootstrap(deps);
  // Recorded on globalThis for the public /api/health/db endpoint — the one
  // place a founder can see WHY a fresh deploy didn't provision (the runner
  // itself never throws, so a failure is otherwise only visible in server logs).
  recordBootstrapResult(result);
  return result;
}

async function runBootstrap(deps: BootstrapDeps): Promise<BootstrapResult> {
  const log = deps.logger ?? console;
  const envSource = deps.envSource ?? {
    SUPABASE_DB_URL: env.SUPABASE_DB_URL,
    POSTGRES_URL: env.POSTGRES_URL,
    POSTGRES_URL_NON_POOLING: env.POSTGRES_URL_NON_POOLING,
    DB_BOOTSTRAP: env.DB_BOOTSTRAP,
    PAYLOAD_DATABASE_URL: env.PAYLOAD_DATABASE_URL,
    // Seed for the derived CMS credentials (see lib/cms/derived-credentials).
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    NODE_ENV: env.NODE_ENV,
    // Set by Next itself during `next build` (like NEXT_RUNTIME), so it lives
    // outside the zod env schema.
    // eslint-disable-next-line no-restricted-properties, turbo/no-undeclared-env-vars
    NEXT_PHASE: process.env.NEXT_PHASE,
  };
  const migrations = deps.migrations ?? supabaseMigrations;
  const none: BootstrapResult = {
    skipped: false,
    appliedVersions: [],
    cmsRoleCreated: false,
    cmsWarmed: false,
  };

  if (envSource.DB_BOOTSTRAP === "off") {
    return { ...none, skipped: "opt-out" };
  }
  // register() also runs in `next build`'s prerender workers — provisioning is
  // a runtime concern, and preview/CI builds may have no DB access at all.
  if (envSource.NEXT_PHASE === "phase-production-build") {
    return { ...none, skipped: "build-phase" };
  }
  const adminUrl = resolveAdminDbUrl(envSource);
  if (!adminUrl) {
    log.info(
      "[db-bootstrap] no SUPABASE_DB_URL / POSTGRES_URL_NON_POOLING — skipping runtime provisioning (manual `supabase db push` flow)",
    );
    return { ...none, skipped: "no-url" };
  }

  let client: BootstrapClient | undefined;
  let locked = false;
  try {
    client = await connectWithRetry(
      deps.createClient ?? defaultCreateClient,
      adminUrl,
      log,
      deps.sleep ?? defaultSleep,
    );
    // Hosted role defaults are too short for DDL of this size.
    await client.query(`set statement_timeout = '5min'`);

    // Fast path: a fully-provisioned, fully-migrated DB costs one inspection
    // round, no lock. `pendingCms` keeps a deploy that adds a Payload migration
    // from short-circuiting here — it must take the lock and run it too.
    const state = await inspectState(
      client,
      migrations,
      deps.cmsMigrationNames,
    );
    if (
      state.pending.length === 0 &&
      state.roleExists &&
      state.cmsSchemaExists &&
      state.pendingCms.length === 0
    ) {
      return { ...none, skipped: "up-to-date" };
    }

    // Serialize concurrent cold-booting instances; the session-level lock is
    // why the connection must be session-mode (never the transaction pooler).
    await client.query(`select pg_advisory_lock(hashtext($1)::bigint)`, [
      BOOTSTRAP_LOCK_KEY,
    ]);
    locked = true;
    const inLock = await inspectState(
      client,
      migrations,
      deps.cmsMigrationNames,
    ); // double-check

    const bundledVersions = new Set(migrations.map((m) => m.version));
    const remoteAhead = [...inLock.applied].filter(
      (v) => !bundledVersions.has(v),
    );
    if (remoteAhead.length > 0) {
      log.warn(
        `[db-bootstrap] database has ${remoteAhead.length} migration(s) this build doesn't bundle (${remoteAhead.join(", ")}) — continuing`,
      );
    }

    const appliedVersions: string[] = [];
    if (inLock.pending.length > 0) {
      for (const sql of ENSURE_LEDGER_SQL) {
        await client.query(sql);
      }
      for (const migration of inLock.pending) {
        try {
          await client.query("begin");
          await client.query(migration.sql);
          await client.query(
            `insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)`,
            [migration.version, migration.name, [migration.sql]],
          );
          await client.query("commit");
          appliedVersions.push(migration.version);
          log.info(
            `[db-bootstrap] applied migration ${migration.version}_${migration.name}`,
          );
        } catch (error) {
          await client.query("rollback").catch(() => undefined);
          log.error(
            `[db-bootstrap] migration ${migration.version}_${migration.name} failed — stopping; applied migrations stay recorded and the next boot retries the rest`,
            error,
          );
          return { ...none, appliedVersions, error: summarizeDbError(error) };
        }
      }
    }

    let cmsRoleCreated = false;
    try {
      cmsRoleCreated = await provisionCms(
        client,
        envSource,
        inLock.roleExists,
        log,
      );
    } catch (error) {
      log.error(
        "[db-bootstrap] cms schema/role provisioning failed — /admin stays unavailable until supabase/payload/00_cms_role.sql is applied manually",
        error,
      );
    }

    // Heal accounts created before the handle_new_user trigger existed.
    try {
      await client.query("begin");
      await client.query(PROFILE_BACKFILL_SQL);
      await client.query(FOUNDER_FLAG_SQL);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      log.error("[db-bootstrap] profile backfill failed", error);
    }

    // Run Payload's migrations (+ extension reconcile) HERE, still holding the
    // advisory lock, so the first-boot CMS migration is serialized across
    // instances and never runs at request time. A concurrent cold start blocks
    // on the lock above, then finds the ledger complete and no-ops — so a
    // failed migration's process.exit (the FUNCTION_INVOCATION_FAILED 500)
    // can't happen. Best-effort: a failure here is logged, not thrown, and the
    // boot continues (request-path getPayload would retry it).
    let cmsWarmed = false;
    if (deps.migrateCms) {
      try {
        await deps.migrateCms();
        cmsWarmed = true;
      } catch (error) {
        log.error(
          "[db-bootstrap] CMS migrate/warm-up failed under the init lock — the first request will retry it",
          error,
        );
      }
    }

    return { skipped: false, appliedVersions, cmsRoleCreated, cmsWarmed };
  } catch (error) {
    log.error(
      "[db-bootstrap] failed — continuing boot; the app degrades to the manual `supabase db push` flow",
      error,
    );
    return { ...none, skipped: "error", error: summarizeDbError(error) };
  } finally {
    if (client) {
      if (locked) {
        await client
          .query(`select pg_advisory_unlock(hashtext($1)::bigint)`, [
            BOOTSTRAP_LOCK_KEY,
          ])
          .catch(() => undefined);
      }
      await client.end().catch(() => undefined);
    }
  }
}
