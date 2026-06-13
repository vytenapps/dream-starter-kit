-- AI Chat extension · unify channel threads into ext_chat_threads
-- So a signed-in user's web/mobile chat history can include their Slack /
-- Sendblue / etc. conversations, ALL channels persist into the same
-- ext_chat_threads + ext_chat_messages tables (not a separate jsonb store).
-- A thread carries its `channel` + `channel_thread_key`; `user_id` is the
-- owner when the channel contact is linked to an app account (nullable until
-- then — RLS `user_id = auth.uid()` naturally hides unlinked channel threads
-- from web clients; the service-role channel writer bypasses RLS).

alter table public.ext_chat_threads
  alter column user_id drop not null;

alter table public.ext_chat_threads
  add column if not exists channel text not null default 'web',
  add column if not exists channel_thread_key text,
  add column if not exists contact_key text;

-- One thread per (channel, channel_thread_key) for upsert-by-conversation.
create unique index if not exists ext_chat_threads_channel_key
  on public.ext_chat_threads (channel, channel_thread_key)
  where channel_thread_key is not null;

create index if not exists ext_chat_threads_channel_idx
  on public.ext_chat_threads (channel);

-- Threads now live in ext_chat_threads; the per-channel jsonb store from 004
-- is redundant. Contacts / dedupe / quota tables stay.
drop table if exists public.ext_chat_channel_threads cascade;
