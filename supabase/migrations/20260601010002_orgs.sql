-- 0002 · Teams / multi-tenancy (optional — drop for single-user apps)
-- organizations, memberships, invitations. Org-scoped RLS uses SECURITY DEFINER
-- helpers to avoid infinite recursion on the memberships table. (docs/ERD.md)

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on public.organizations (owner_id);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
-- Indexes on FKs used in RLS predicates.
create index on public.memberships (org_id);
create index on public.memberships (user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now()
);
create index on public.invitations (org_id);

-- Membership helpers. SECURITY DEFINER runs as the function owner, so the
-- internal SELECT on memberships does NOT re-trigger memberships' RLS (which
-- would recurse). This is the canonical Supabase pattern.
create or replace function public.is_org_member(_org uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = _org and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_org_admin(_org uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = _org
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  );
$$;

-- On org creation, enroll the owner as an 'owner' member (avoids the
-- chicken-and-egg where the admin-only insert policy would block the first row).
create or replace function public.handle_new_organization()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.memberships (org_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (org_id, user_id) do nothing;
  return new;
end;
$$;

create trigger on_organization_created
  after insert on public.organizations
  for each row execute function public.handle_new_organization();

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;

-- organizations: members read; owner creates/updates/deletes.
create policy "orgs: select if member"
  on public.organizations for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_org_member(id));
create policy "orgs: insert own"
  on public.organizations for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "orgs: update owner"
  on public.organizations for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "orgs: delete owner"
  on public.organizations for delete to authenticated
  using (owner_id = (select auth.uid()));

-- memberships: members read co-members; admins manage. The first (owner) row
-- is created by the trigger above (SECURITY DEFINER).
create policy "memberships: select if member"
  on public.memberships for select to authenticated
  using (public.is_org_member(org_id));
create policy "memberships: admins insert"
  on public.memberships for insert to authenticated
  with check (public.is_org_admin(org_id));
create policy "memberships: admins update"
  on public.memberships for update to authenticated
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));
create policy "memberships: admins delete"
  on public.memberships for delete to authenticated
  using (public.is_org_admin(org_id));

-- invitations: org admins manage.
create policy "invitations: admins all"
  on public.invitations for all to authenticated
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));
