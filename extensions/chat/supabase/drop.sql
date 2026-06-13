-- Teardown for `pnpm ext remove chat` (skipped with --keep-data).
drop table if exists public.ext_chat_outbound_counters cascade;
drop table if exists public.ext_chat_processed_inbound cascade;
drop table if exists public.ext_chat_channel_contacts cascade;
drop table if exists public.ext_chat_votes cascade;
drop table if exists public.ext_chat_suggestions cascade;
drop table if exists public.ext_chat_documents cascade;
drop table if exists public.ext_chat_messages cascade;
drop table if exists public.ext_chat_threads cascade;
