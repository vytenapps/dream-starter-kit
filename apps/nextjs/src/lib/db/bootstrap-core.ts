/**
 * Pure helpers for the runtime DB bootstrap (see ./bootstrap.ts). No driver,
 * no I/O — everything here is unit-tested in bootstrap-core.test.ts.
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
