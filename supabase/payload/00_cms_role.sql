-- Payload CMS — dedicated Postgres schema + least-privilege login role.
--
-- Payload owns the `cms` schema end-to-end (its own tables + migrations, run via
-- `pnpm cms:migrate`). It connects as `payload_cms`, a role scoped to `cms` only —
-- NOT the Supabase service-role key, and with no access to `public`/`auth`. This
-- keeps Payload outside Supabase RLS by design while containing its blast radius.
--
-- Applied LOCALLY by `supabase db reset` (wired via config.toml
-- [db.migrations].schema_paths). On HOSTED Supabase, run this ONCE in the SQL
-- editor with a real password — `CREATE ROLE` is not captured by `supabase db diff`.

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

-- Defensive: ensure the role can touch nothing outside `cms`.
revoke all on schema public from payload_cms;
revoke all on schema auth from payload_cms;

-- Objects Payload creates in `cms` are owned by payload_cms.
alter default privileges for role payload_cms in schema cms grant all on tables to payload_cms;
alter default privileges for role payload_cms in schema cms grant all on sequences to payload_cms;
