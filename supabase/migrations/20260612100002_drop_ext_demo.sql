-- Teardown for the removed "demo" extension (pnpm ext remove).
-- Teardown for `pnpm ext remove demo` (skipped with --keep-data).
drop table if exists public.ext_demo_items cascade;
