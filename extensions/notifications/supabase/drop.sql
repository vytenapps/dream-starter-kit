-- Teardown for `pnpm ext remove notifications` (skipped with --keep-data).
drop table if exists public.ext_notifications_push_tokens cascade;
drop table if exists public.ext_notifications cascade;
