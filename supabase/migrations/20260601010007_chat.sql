-- 0007 · AI assistant (persisted chat)
-- chat_threads / chat_messages back the in-app assistant (AI SDK via the AI
-- Gateway). token_usage supports cost/observability. (ERD.md)

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
