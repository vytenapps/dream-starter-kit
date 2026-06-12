-- Teardown for `pnpm ext remove billing` (skipped with --keep-data).
drop table if exists public.ext_billing_subscriptions cascade;
drop table if exists public.ext_billing_prices cascade;
drop table if exists public.ext_billing_products cascade;
drop table if exists public.ext_billing_customers cascade;
