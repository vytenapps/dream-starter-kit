-- Teardown for `pnpm ext remove chat` (skipped with --keep-data).
drop table if exists public.ext_chat_votes cascade;
drop table if exists public.ext_chat_suggestions cascade;
drop table if exists public.ext_chat_documents cascade;
drop table if exists public.ext_chat_messages cascade;
drop table if exists public.ext_chat_threads cascade;
