-- AI Chat extension · initial schema
-- ext_chat_threads / ext_chat_messages back the in-app assistant (AI SDK via
-- the AI Gateway). token_usage supports cost/observability. DDL is
-- reattach-friendly (if not exists / drop-then-create policies) so a reinstall
-- after `ext remove --keep-data` adopts the surviving tables.

create table if not exists public.ext_chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);
create index if not exists ext_chat_threads_user_id_idx
  on public.ext_chat_threads (user_id);

create table if not exists public.ext_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ext_chat_threads (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null default '',
  token_usage jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ext_chat_messages_thread_id_idx
  on public.ext_chat_messages (thread_id);

alter table public.ext_chat_threads enable row level security;
alter table public.ext_chat_messages enable row level security;

drop policy if exists "ext_chat_threads: own" on public.ext_chat_threads;
create policy "ext_chat_threads: own"
  on public.ext_chat_threads for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Messages are reachable only through a thread the user owns.
drop policy if exists "ext_chat_messages: via own thread" on public.ext_chat_messages;
create policy "ext_chat_messages: via own thread"
  on public.ext_chat_messages for all to authenticated
  using (
    exists (
      select 1 from public.ext_chat_threads t
      where t.id = ext_chat_messages.thread_id and t.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.ext_chat_threads t
      where t.id = ext_chat_messages.thread_id and t.user_id = (select auth.uid())
    )
  );
