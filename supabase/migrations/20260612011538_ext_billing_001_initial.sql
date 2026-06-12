-- Billing extension · initial schema (Stripe-synced mirror)
-- Clients may READ their own customer/subscription rows; the product catalog is
-- world-readable. NO write policies exist for clients — the Stripe webhook
-- (billing-stripe-webhook edge function) writes these using the service role,
-- which bypasses RLS entirely. DDL is reattach-friendly (if not exists /
-- drop-then-create policies) so a reinstall after `ext remove --keep-data`
-- adopts the surviving tables.

create table if not exists public.ext_billing_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists ext_billing_customers_user_id_idx
  on public.ext_billing_customers (user_id);

create table if not exists public.ext_billing_products (
  id text primary key, -- Stripe product id
  active boolean not null default true,
  name text,
  description text,
  image text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ext_billing_prices (
  id text primary key, -- Stripe price id
  product_id text references public.ext_billing_products (id) on delete cascade,
  active boolean not null default true,
  unit_amount integer,
  currency text,
  type text check (type in ('one_time', 'recurring')),
  interval text check (interval in ('day', 'week', 'month', 'year')),
  interval_count integer,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ext_billing_prices_product_id_idx
  on public.ext_billing_prices (product_id);

create table if not exists public.ext_billing_subscriptions (
  id text primary key, -- Stripe subscription id
  user_id uuid not null references public.profiles (id) on delete cascade,
  price_id text references public.ext_billing_prices (id),
  status text check (
    status in (
      'trialing', 'active', 'past_due', 'canceled',
      'incomplete', 'incomplete_expired', 'unpaid', 'paused'
    )
  ),
  quantity integer,
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ext_billing_subscriptions_user_id_idx
  on public.ext_billing_subscriptions (user_id);
create index if not exists ext_billing_subscriptions_price_id_idx
  on public.ext_billing_subscriptions (price_id);

alter table public.ext_billing_customers enable row level security;
alter table public.ext_billing_products enable row level security;
alter table public.ext_billing_prices enable row level security;
alter table public.ext_billing_subscriptions enable row level security;

-- Read own only (no write policies => clients cannot write; webhook uses service role).
drop policy if exists "ext_billing_customers: select own" on public.ext_billing_customers;
create policy "ext_billing_customers: select own"
  on public.ext_billing_customers for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "ext_billing_subscriptions: select own" on public.ext_billing_subscriptions;
create policy "ext_billing_subscriptions: select own"
  on public.ext_billing_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

-- Public catalog: anyone may read products/prices (e.g. a pricing page).
drop policy if exists "ext_billing_products: read all" on public.ext_billing_products;
create policy "ext_billing_products: read all"
  on public.ext_billing_products for select to authenticated, anon
  using (true);

drop policy if exists "ext_billing_prices: read all" on public.ext_billing_prices;
create policy "ext_billing_prices: read all"
  on public.ext_billing_prices for select to authenticated, anon
  using (true);
