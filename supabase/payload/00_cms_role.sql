-- Payload CMS — dedicated Postgres schema + least-privilege login role.
--
-- Payload owns the `cms` schema end-to-end (its own tables + migrations, run via
-- `pnpm cms:migrate`). It connects as `payload_cms`, a role scoped to `cms` only —
-- NOT the Supabase service-role key, and with no access to `public`/`auth`. This
-- keeps Payload outside Supabase RLS by design while containing its blast radius.
--
-- Applied LOCALLY by `supabase db reset` (wired via config.toml as the first entry
-- of [db.seed].sql_paths, so it runs right before seed.sql on every reset). On
-- HOSTED Supabase, run this ONCE in the SQL editor with a real password — role +
-- schema provisioning is intentionally local-only (this dev password must never
-- reach a hosted DB; that is also why it is NOT a migration, which `db push`
-- would replay against production), and `CREATE ROLE` is not captured by
-- `supabase db diff` anyway.

create schema if not exists cms;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'payload_cms') then
    create role payload_cms with login password 'payload_local_dev_only'
      noinherit nocreatedb nocreaterole nosuperuser;
  end if;
end
$$;

-- Payload needs USAGE + CREATE on `cms` (its migrations build tables/enums there).
grant usage, create on schema cms to payload_cms;

-- Connect already scoped to `cms` (belt-and-suspenders with the connection-string
-- `?options=-c search_path=cms` and the adapter's `schemaName: 'cms'`).
alter role payload_cms set search_path = cms;

-- Defensive: ensure the role can touch nothing outside `cms`. (`auth` may emit a
-- harmless "no privileges could be revoked" notice — the role never had any.)
revoke all on schema public from payload_cms;
revoke all on schema auth from payload_cms;

-- NOTE: no `alter default privileges for role payload_cms ...` here. Payload
-- always connects AS payload_cms and creates its `cms` objects itself, so it owns
-- them with full privileges automatically — granting itself defaults is a no-op.
-- It also errors under the superuser that runs db reset (you must be a member of
-- the target role to set its default privileges), which would abort the reset.
