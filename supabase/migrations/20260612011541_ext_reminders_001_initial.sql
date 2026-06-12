-- Reminders extension · initial schema
-- ext_reminders: user-owned scheduled nudges. DDL is reattach-friendly
-- (if not exists / drop-then-create policies) so a reinstall after
-- `ext remove --keep-data` adopts the surviving table.

create table if not exists public.ext_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  due_at timestamptz not null,
  channel text not null default 'push' check (channel in ('push', 'email')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'canceled')),
  created_at timestamptz not null default now()
);
create index if not exists ext_reminders_user_id_idx
  on public.ext_reminders (user_id);
-- The scheduler (reminders-process edge function) scans due+pending.
create index if not exists ext_reminders_status_due_at_idx
  on public.ext_reminders (status, due_at);

alter table public.ext_reminders enable row level security;

drop policy if exists "ext_reminders: own" on public.ext_reminders;
create policy "ext_reminders: own"
  on public.ext_reminders for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
