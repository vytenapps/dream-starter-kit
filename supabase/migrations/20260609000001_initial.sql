-- Initial schema · Dream Starter Kit
-- Single baseline migration (squashed from the original 0001–0008 series).
-- Sections: identity · teams · billing · engagement · files+storage · chat · CMS staff.
-- Every table has RLS with owner-scoped policies — see docs/ERD.md (source of truth).

create extension if not exists pgcrypto;

-- ============================================================================
-- Identity
-- profiles: app-level user record, 1:1 with auth.users (same id). The anchor
-- for most RLS policies. Created by a trigger on signup. (docs/ERD.md)
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  is_staff boolean not null default false
);

comment on table public.profiles is
  'App-level user record, 1:1 with auth.users (same id). Created by handle_new_user() on signup.';

comment on column public.profiles.is_staff is
  'Grants access to the Payload CMS admin via the Supabase->Payload SSO bridge. The first signup is auto-flagged; default-deny otherwise.';

-- Mirror auth.users -> profiles on signup. SECURITY DEFINER so it can insert
-- regardless of RLS; empty search_path is the Supabase security best practice
-- (every reference is schema-qualified). The FIRST profile created is flagged
-- staff (the founder/admin) — default-deny for everyone after.
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: a user sees/updates only their own profile. Inserts happen via the
-- trigger (SECURITY DEFINER); deletes cascade from auth.users.
alter table public.profiles enable row level security;

create policy "profiles: select own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Prevent privilege escalation: the "profiles: update own" RLS policy would otherwise
-- let a user flip their own is_staff. A column-level revoke can't subtract from a
-- table-level grant, so revoke table UPDATE and re-grant only the user-editable columns.
-- (RLS still scopes updates to the user's own row; SECURITY DEFINER functions and the
-- service_role keep full access and set is_staff out-of-band.)
revoke update on public.profiles from authenticated, anon;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- ============================================================================
-- Teams / multi-tenancy (optional — drop for single-user apps)
-- organizations, memberships, invitations. Org-scoped RLS uses SECURITY DEFINER
-- helpers to avoid infinite recursion on the memberships table. (docs/ERD.md)
-- ============================================================================

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

-- ============================================================================
-- Billing (Stripe-synced)
-- Clients may READ their own customer/subscription rows; the product catalog is
-- world-readable. NO write policies exist for clients — the Stripe webhook
-- (a Supabase edge function) writes these using the service role, which
-- bypasses RLS entirely. (docs/ERD.md)
-- ============================================================================

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);
create index on public.customers (user_id);

create table public.products (
  id text primary key, -- Stripe product id
  active boolean not null default true,
  name text,
  description text,
  image text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table public.prices (
  id text primary key, -- Stripe price id
  product_id text references public.products (id) on delete cascade,
  active boolean not null default true,
  unit_amount integer,
  currency text,
  type text check (type in ('one_time', 'recurring')),
  interval text check (interval in ('day', 'week', 'month', 'year')),
  interval_count integer,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index on public.prices (product_id);

create table public.subscriptions (
  id text primary key, -- Stripe subscription id
  user_id uuid not null references public.profiles (id) on delete cascade,
  price_id text references public.prices (id),
  status text check (
    status in (
      'trialing', 'active', 'past_due', 'canceled',
      'incomplete', 'incomplete_expired', 'unpaid', 'paused'
    )
  ),
  quantity integer,
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);
create index on public.subscriptions (user_id);
create index on public.subscriptions (price_id);

alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.prices enable row level security;
alter table public.subscriptions enable row level security;

-- Read own only (no write policies => clients cannot write; webhook uses service role).
create policy "customers: select own"
  on public.customers for select to authenticated
  using (user_id = (select auth.uid()));

create policy "subscriptions: select own"
  on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

-- Public catalog: anyone may read products/prices (e.g. a pricing page).
create policy "products: read all"
  on public.products for select to authenticated, anon
  using (true);
create policy "prices: read all"
  on public.prices for select to authenticated, anon
  using (true);

-- ============================================================================
-- Engagement
-- reminders (scheduled nudges), push_tokens (Expo), notifications (in-app feed).
-- All strictly user-owned. (docs/ERD.md)
-- ============================================================================

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  due_at timestamptz not null,
  channel text not null default 'push' check (channel in ('push', 'email')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'canceled')),
  created_at timestamptz not null default now()
);
create index on public.reminders (user_id);
create index on public.reminders (status, due_at); -- the scheduler scans due+pending

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null, -- Expo push token
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  unique (user_id, token)
);
create index on public.push_tokens (user_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text,
  body text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id);

alter table public.reminders enable row level security;
alter table public.push_tokens enable row level security;
alter table public.notifications enable row level security;

create policy "reminders: own"
  on public.reminders for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "push_tokens: own"
  on public.push_tokens for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- notifications are typically written by the server (service role), but a user
-- may read/mark-read/delete their own.
create policy "notifications: own"
  on public.notifications for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ============================================================================
-- Files + Storage
-- `files` is metadata for objects in Supabase Storage. The bucket's RLS lives on
-- storage.objects, path-prefixed by user id (convention: "<user_id>/..."),
-- mirroring the files table's ownership. (docs/ERD.md)
-- ============================================================================

create table public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  bucket text not null default 'user-files',
  path text not null, -- Storage object path, e.g. "<user_id>/avatar.png"
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);
create index on public.files (user_id);

alter table public.files enable row level security;

create policy "files: own"
  on public.files for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Private bucket for user uploads.
insert into storage.buckets (id, name, public)
values ('user-files', 'user-files', false)
on conflict (id) do nothing;

-- Storage RLS: a user may only touch objects under their own "<user_id>/" prefix.
create policy "user-files: select own"
  on storage.objects for select to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "user-files: insert own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "user-files: update own"
  on storage.objects for update to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "user-files: delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ============================================================================
-- AI assistant (persisted chat)
-- chat_threads / chat_messages back the in-app assistant (AI SDK via the AI
-- Gateway). token_usage supports cost/observability. (docs/ERD.md)
-- ============================================================================

create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);
create index on public.chat_threads (user_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null default '',
  token_usage jsonb,
  created_at timestamptz not null default now()
);
create index on public.chat_messages (thread_id);

alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;

create policy "chat_threads: own"
  on public.chat_threads for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Messages are reachable only through a thread the user owns.
create policy "chat_messages: via own thread"
  on public.chat_messages for all to authenticated
  using (
    exists (
      select 1 from public.chat_threads t
      where t.id = chat_messages.thread_id and t.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.chat_threads t
      where t.id = chat_messages.thread_id and t.user_id = (select auth.uid())
    )
  );
