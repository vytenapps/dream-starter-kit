-- Teardown for `pnpm ext remove reminders` (skipped with --keep-data).
drop table if exists public.ext_reminders cascade;
