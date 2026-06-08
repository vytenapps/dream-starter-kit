-- 0008 · CMS staff flag + Supabase→Payload SSO bridge support
-- Designates which app users may access the Payload CMS admin via the auth bridge.
-- The FIRST signup is auto-flagged staff (the founder); flip is_staff to grant more
-- editors. Default-deny: a normal app signup gets no CMS access. (docs/ARCHITECTURE.md)

alter table public.profiles
  add column if not exists is_staff boolean not null default false;

comment on column public.profiles.is_staff is
  'Grants access to the Payload CMS admin via the Supabase->Payload SSO bridge. The first signup is auto-flagged; default-deny otherwise.';

-- Supersede handle_new_user() (defined in 20260601010001_identity.sql) so the first
-- profile created is staff. Append-only: this `create or replace` replaces the body
-- without editing the shipped migration.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, is_staff)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    -- First profile in the table becomes staff (the founder/admin).
    (select count(*) = 0 from public.profiles)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Prevent privilege escalation: the "profiles: update own" RLS policy would otherwise
-- let a user flip their own is_staff. A column-level revoke can't subtract from a
-- table-level grant, so revoke table UPDATE and re-grant only the user-editable columns.
-- (RLS still scopes updates to the user's own row; SECURITY DEFINER functions and the
-- service_role keep full access and set is_staff out-of-band.)
revoke update on public.profiles from authenticated, anon;
grant update (display_name, avatar_url) on public.profiles to authenticated;
