-- AI Chat extension · Chat SDK parity (vendored vercel/ai-chatbot UI)
-- Threads gain visibility/last_context/updated_at; messages gain structured
-- `parts` + `attachments` (UIMessage shape) while `content` stays as a
-- plain-text projection for the native screens. New artifact tables mirror
-- upstream Document/Suggestion/Vote, versioned by (id, created_at). DDL is
-- reattach-friendly (if not exists / drop-then-create policies).
-- The chat-uploads storage bucket lives in a HOST migration (extensions may
-- not touch the storage schema).

alter table public.ext_chat_threads
  add column if not exists visibility text not null default 'private'
    check (visibility in ('private', 'public')),
  add column if not exists last_context jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.ext_chat_messages
  add column if not exists parts jsonb,
  add column if not exists attachments jsonb not null default '[]'::jsonb;

-- Artifact documents: append-only versions keyed by (id, created_at) — the
-- upstream Chat SDK versioning model (every save inserts a new version row).
create table if not exists public.ext_chat_documents (
  id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  content text,
  kind text not null default 'text'
    check (kind in ('text', 'code', 'image', 'sheet')),
  primary key (id, created_at)
);
create index if not exists ext_chat_documents_user_id_idx
  on public.ext_chat_documents (user_id);

create table if not exists public.ext_chat_suggestions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  document_created_at timestamptz not null,
  original_text text not null,
  suggested_text text not null,
  description text,
  is_resolved boolean not null default false,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  foreign key (document_id, document_created_at)
    references public.ext_chat_documents (id, created_at) on delete cascade
);
create index if not exists ext_chat_suggestions_document_idx
  on public.ext_chat_suggestions (document_id, document_created_at);

create table if not exists public.ext_chat_votes (
  thread_id uuid not null references public.ext_chat_threads (id) on delete cascade,
  message_id uuid not null references public.ext_chat_messages (id) on delete cascade,
  is_upvoted boolean not null,
  primary key (thread_id, message_id)
);

alter table public.ext_chat_documents enable row level security;
alter table public.ext_chat_suggestions enable row level security;
alter table public.ext_chat_votes enable row level security;

drop policy if exists "ext_chat_documents: own" on public.ext_chat_documents;
create policy "ext_chat_documents: own"
  on public.ext_chat_documents for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "ext_chat_suggestions: own" on public.ext_chat_suggestions;
create policy "ext_chat_suggestions: own"
  on public.ext_chat_suggestions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Votes are reachable only through a thread the user owns.
drop policy if exists "ext_chat_votes: via own thread" on public.ext_chat_votes;
create policy "ext_chat_votes: via own thread"
  on public.ext_chat_votes for all to authenticated
  using (
    exists (
      select 1 from public.ext_chat_threads t
      where t.id = ext_chat_votes.thread_id and t.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.ext_chat_threads t
      where t.id = ext_chat_votes.thread_id and t.user_id = (select auth.uid())
    )
  );
