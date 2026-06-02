-- 0004 · App domain (rename to your idea's nouns)
-- projects -> items. Projects are owned by a user OR an org; items inherit
-- access from their project. Per-command policies make the rules explicit and
-- safe (members can read shared items; only the creator mutates their own). (docs/ERD.md)

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete cascade, -- nullable: personal project
  name text not null,
  created_at timestamptz not null default now()
);
create index on public.projects (owner_id);
create index on public.projects (org_id);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  data jsonb not null default '{}'::jsonb, -- idea-specific fields
  status text not null default 'open',
  created_at timestamptz not null default now()
);
create index on public.items (project_id);
create index on public.items (created_by);

-- Can the current user access this project? Personal owner, or org member.
-- SECURITY DEFINER so items policies don't double-evaluate projects' RLS.
create or replace function public.can_access_project(_project_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.projects p
    where p.id = _project_id
      and (
        (p.org_id is null and p.owner_id = (select auth.uid()))
        or (p.org_id is not null and public.is_org_member(p.org_id))
      )
  );
$$;

alter table public.projects enable row level security;
alter table public.items enable row level security;

-- projects: members read; creator (owner) or org admin mutate.
create policy "projects: select (owner or org member)"
  on public.projects for select to authenticated
  using (
    (org_id is null and owner_id = (select auth.uid()))
    or (org_id is not null and public.is_org_member(org_id))
  );
create policy "projects: insert own"
  on public.projects for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (org_id is null or public.is_org_member(org_id))
  );
create policy "projects: update (owner or org admin)"
  on public.projects for update to authenticated
  using (owner_id = (select auth.uid()) or (org_id is not null and public.is_org_admin(org_id)))
  with check (owner_id = (select auth.uid()) or (org_id is not null and public.is_org_admin(org_id)));
create policy "projects: delete (owner or org admin)"
  on public.projects for delete to authenticated
  using (owner_id = (select auth.uid()) or (org_id is not null and public.is_org_admin(org_id)));

-- items: anyone with project access reads; only the creator mutates their item.
create policy "items: select via project"
  on public.items for select to authenticated
  using (public.can_access_project(project_id));
create policy "items: insert own in accessible project"
  on public.items for insert to authenticated
  with check (public.can_access_project(project_id) and created_by = (select auth.uid()));
create policy "items: update own"
  on public.items for update to authenticated
  using (public.can_access_project(project_id) and created_by = (select auth.uid()))
  with check (public.can_access_project(project_id) and created_by = (select auth.uid()));
create policy "items: delete own"
  on public.items for delete to authenticated
  using (public.can_access_project(project_id) and created_by = (select auth.uid()));
