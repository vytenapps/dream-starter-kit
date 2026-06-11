/**
 * Pure helpers for the runtime DB bootstrap (see ./bootstrap.ts) and the
 * Payload pool config (payload.config.ts). No driver, no I/O — everything
 * here is unit-tested in bootstrap-core.test.ts.
 */
import type { SqlMigration } from "./migrations";

/** The login role Payload connects as (see supabase/payload/00_cms_role.sql). */
export const CMS_ROLE = "payload_cms";

/**
 * The local-dev password shipped in .env.example / 00_cms_role.sql. The
 * bootstrap refuses to create the hosted role with it (production guard).
 */
export const DEV_PAYLOAD_PASSWORD = "payload_local_dev_only";

/** Advisory-lock key serializing concurrent cold-booting instances. */
export const BOOTSTRAP_LOCK_KEY = "dream-starter-kit:db-bootstrap";

const MIGRATION_FILENAME = /^(\d{14})_(.+)\.sql$/;

/** Parses `<14-digit-version>_<name>.sql`; null when the name doesn't match. */
export function parseMigrationFilename(
  file: string,
): { version: string; name: string } | null {
  const match = MIGRATION_FILENAME.exec(file);
  const version = match?.[1];
  const name = match?.[2];
  if (!version || !name) return null;
  return { version, name };
}

/**
 * Privileged connection the bootstrap uses. `SUPABASE_DB_URL` (explicit) wins
 * over `POSTGRES_URL_NON_POOLING` (auto-injected by the Vercel<->Supabase
 * integration). Both must be session-mode — the pooled `POSTGRES_URL` is never
 * considered because transaction pooling breaks session advisory locks.
 */
export function resolveAdminDbUrl(
  env: Record<string, string | undefined>,
): string | undefined {
  // Treat empty strings as absent — a `VAR=""` line must not be "configured".
  if (env.SUPABASE_DB_URL) return env.SUPABASE_DB_URL;
  if (env.POSTGRES_URL_NON_POOLING) return env.POSTGRES_URL_NON_POOLING;
  return undefined;
}

/** pg-compatible ssl setting with libpq-style semantics. */
export type PgSsl = false | true | { rejectUnauthorized: false };

export interface PgConnectionOptions {
  connectionString?: string;
  /** Key omitted = no override; pg's own defaults / PGSSLMODE apply. */
  ssl?: PgSsl;
}

/**
 * `sslmode` params pg-connection-string maps to certificate FILES it reads
 * from disk (or to native libpq-compat handling). When any of these are
 * present the URL is passed through untouched — overriding them would break a
 * working custom-CA setup, and this module must stay pure (no fs).
 */
const ADVANCED_SSL_PARAMS = [
  "ssl",
  "sslcert",
  "sslkey",
  "sslrootcert",
  "sslpassword",
  "uselibpqcompat",
];

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Maps a Postgres connection string to a `pg.Client`/`pg.Pool` config with
 * libpq SSL semantics. Exists because pg@8 treats `sslmode=require` as
 * verify-full — and hosted Supabase's cert chain is rooted in Supabase's own
 * CA, so verification fails with SELF_SIGNED_CERT_IN_CHAIN and a fresh deploy
 * never provisions. Worse, pg merges `parse(connectionString)` OVER explicit
 * options (connection-parameters.js), so a computed `ssl` only survives if the
 * `sslmode` param is also STRIPPED from the URL. Semantics:
 *
 *   - `disable` → ssl: false
 *   - `allow` / `prefer` / `require` / `no-verify` → encrypted, UNVERIFIED
 *     (libpq's `require`; what hosted Supabase needs)
 *   - `verify-ca` / `verify-full` (or unknown values — fail closed) → full
 *     verification; supply Supabase's CA via NODE_EXTRA_CA_CERTS
 *   - no `sslmode`: local hosts stay untouched (plaintext local stack, and
 *     PGSSLMODE keeps working); remote hosts default to encrypted-unverified
 *     (`sslmode=disable` is the opt-out)
 *
 * The param is stripped by string surgery, never `URL.toString()` — a
 * round-trip would re-encode params like `options=-c%20search_path%3Dcms`.
 * Unparseable inputs (libpq key=value strings, multi-host URLs, socket paths)
 * and URLs carrying advanced ssl params pass through untouched.
 */
export function pgConnectionOptions(
  connectionString: string | undefined,
): PgConnectionOptions {
  if (!connectionString) return {};
  const passthrough: PgConnectionOptions = { connectionString };

  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    return passthrough;
  }
  if (ADVANCED_SSL_PARAMS.some((p) => parsed.searchParams.has(p))) {
    return passthrough;
  }

  const sslmode = parsed.searchParams.get("sslmode");
  if (sslmode === null) {
    const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
    if (LOCAL_HOSTNAMES.has(hostname)) return passthrough;
    return { connectionString, ssl: { rejectUnauthorized: false } };
  }

  let ssl: PgSsl;
  switch (sslmode) {
    case "disable":
      ssl = false;
      break;
    case "allow":
    case "prefer":
    case "require":
    case "no-verify":
      ssl = { rejectUnauthorized: false };
      break;
    // verify-ca, verify-full, and anything unrecognized: full verification
    // (fail closed — matches pg's own current handling).
    default:
      ssl = true;
      break;
  }
  return {
    connectionString: stripQueryParam(connectionString, "sslmode"),
    ssl,
  };
}

/** Removes `key=...` pairs from the query string byte-for-byte (no re-encoding). */
function stripQueryParam(connectionString: string, key: string): string {
  const queryStart = connectionString.indexOf("?");
  if (queryStart === -1) return connectionString;
  const base = connectionString.slice(0, queryStart);
  const query = connectionString
    .slice(queryStart + 1)
    .split("&")
    .filter((pair) => pair.split("=", 1)[0] !== key)
    .join("&");
  return query ? `${base}?${query}` : base;
}

const CONNECTION_STRING_PATTERN = /postgres(ql)?:\/\/\S+/gi;
const MAX_ERROR_MESSAGE = 300;

/**
 * Sanitized error summary for surfaces outside the server log (the public
 * /api/health/db endpoint): code + message only — no stack, and any embedded
 * connection string (credentials!) is redacted.
 */
export function summarizeDbError(error: unknown): {
  code?: string;
  message: string;
} {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : undefined;
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string" && error
        ? error
        : "unknown error";
  const message = raw
    .replace(CONNECTION_STRING_PATTERN, "[redacted]")
    .slice(0, MAX_ERROR_MESSAGE);
  return code === undefined ? { message } : { code, message };
}

/**
 * Bundled migrations not yet recorded in the ledger, in version order.
 * Ledger-only versions (a remote DB ahead of this build) are ignored — the
 * runner logs them, matching `supabase db push`'s version-keyed semantics.
 */
export function pendingMigrations(
  bundled: SqlMigration[],
  appliedVersions: ReadonlySet<string>,
): SqlMigration[] {
  return [...bundled]
    .sort((a, b) => a.version.localeCompare(b.version))
    .filter((m) => !appliedVersions.has(m.version));
}

/**
 * Extracts the login credentials from a Postgres connection string (the
 * `PAYLOAD_DATABASE_URL`), so the bootstrap can create the role with the same
 * password Payload will connect with.
 */
export function parseRoleCredentials(connectionString: string): {
  user: string;
  password: string;
} {
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error("PAYLOAD_DATABASE_URL is not a valid connection URL");
  }
  const user = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  if (!user) {
    throw new Error("PAYLOAD_DATABASE_URL has no user in the URL");
  }
  if (!password) {
    throw new Error(
      "PAYLOAD_DATABASE_URL has no password — the bootstrap needs it to create the role",
    );
  }
  return { user, password };
}

/**
 * Statement-for-statement mirror of supabase/payload/00_cms_role.sql (which
 * remains the local-dev / SQL-editor path). `passwordLiteral` must already be
 * escaped (pg's `Client#escapeLiteral`) and is only used when `createRole` is
 * true — the caller checks `pg_roles` first; an existing role's password is
 * NEVER altered (rotation stays a manual step).
 */
export function cmsProvisionStatements(opts: {
  createRole: boolean;
  passwordLiteral: string;
}): string[] {
  return [
    `create schema if not exists cms`,
    ...(opts.createRole
      ? [
          `create role ${CMS_ROLE} with login password ${opts.passwordLiteral} noinherit nocreatedb nocreaterole nosuperuser`,
        ]
      : []),
    `grant usage, create on schema cms to ${CMS_ROLE}`,
    `alter role ${CMS_ROLE} set search_path = cms`,
    `revoke all on schema public from ${CMS_ROLE}`,
    `revoke all on schema auth from ${CMS_ROLE}`,
  ];
}

/**
 * Creates the Supabase CLI's migration ledger exactly the way the CLI does, so
 * the runtime bootstrap and `supabase db push` share one source of truth and
 * can run in either order.
 */
export const ENSURE_LEDGER_SQL = [
  `create schema if not exists supabase_migrations`,
  `create table if not exists supabase_migrations.schema_migrations (version text not null primary key)`,
  `alter table supabase_migrations.schema_migrations add column if not exists statements text[]`,
  `alter table supabase_migrations.schema_migrations add column if not exists name text`,
];

/**
 * Heals accounts created BEFORE the first bootstrap ran (empty DB → no
 * `handle_new_user` trigger → no profiles row). Mirrors the trigger's insert
 * (supabase/migrations/20260609000001_initial.sql) for any auth.users row
 * missing a profile, then flags the earliest signup as staff — only when no
 * staff profile exists yet, so it can never demote or double-promote.
 */
export const PROFILE_BACKFILL_SQL = `
insert into public.profiles (id, display_name, avatar_url, is_staff)
select
  u.id,
  coalesce(
    u.raw_user_meta_data ->> 'display_name',
    u.raw_user_meta_data ->> 'name',
    split_part(coalesce(u.email, ''), '@', 1)
  ),
  u.raw_user_meta_data ->> 'avatar_url',
  false
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
order by u.created_at
on conflict (id) do nothing
`;

export const FOUNDER_FLAG_SQL = `
update public.profiles
set is_staff = true
where id = (
    select u.id
    from auth.users u
    join public.profiles p on p.id = u.id
    order by u.created_at asc
    limit 1
  )
  and not exists (select 1 from public.profiles where is_staff)
`;
