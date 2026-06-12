-- Notifications extension · initial schema
-- ext_notifications (in-app feed) + ext_notifications_push_tokens (Expo device
-- registrations). Strictly user-owned under RLS; servers write via the service
-- role. DDL is reattach-friendly (if not exists / drop-then-create policies)
-- so a reinstall after `ext remove --keep-data` adopts the surviving tables.

create table if not exists public.ext_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text,
  body text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ext_notifications_user_id_idx
  on public.ext_notifications (user_id);

create table if not exists public.ext_notifications_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null, -- Expo push token
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  unique (user_id, token)
);
create index if not exists ext_notifications_push_tokens_user_id_idx
  on public.ext_notifications_push_tokens (user_id);

alter table public.ext_notifications enable row level security;
alter table public.ext_notifications_push_tokens enable row level security;

-- notifications are typically written by the server (service role), but a user
-- may read/mark-read/delete their own.
drop policy if exists "ext_notifications: own" on public.ext_notifications;
create policy "ext_notifications: own"
  on public.ext_notifications for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "ext_notifications_push_tokens: own"
  on public.ext_notifications_push_tokens;
create policy "ext_notifications_push_tokens: own"
  on public.ext_notifications_push_tokens for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
