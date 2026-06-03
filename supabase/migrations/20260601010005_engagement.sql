-- 0005 · Engagement
-- reminders (scheduled nudges), push_tokens (Expo), notifications (in-app feed).
-- All strictly user-owned. (docs/ERD.md)

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
