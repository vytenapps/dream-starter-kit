-- 0003 · Billing (Stripe-synced)
-- Clients may READ their own customer/subscription rows; the product catalog is
-- world-readable. NO write policies exist for clients — the Stripe webhook
-- (a Supabase edge function) writes these using the service role, which
-- bypasses RLS entirely. (ERD.md)

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);
create index on public.customers (user_id);

create table public.products (
  id text primary key, -- Stripe product id
  active boolean not null default true,
  name text,
  description text,
  image text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table public.prices (
  id text primary key, -- Stripe price id
  product_id text references public.products (id) on delete cascade,
  active boolean not null default true,
  unit_amount integer,
  currency text,
  type text check (type in ('one_time', 'recurring')),
  interval text check (interval in ('day', 'week', 'month', 'year')),
  interval_count integer,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index on public.prices (product_id);

create table public.subscriptions (
  id text primary key, -- Stripe subscription id
  user_id uuid not null references public.profiles (id) on delete cascade,
  price_id text references public.prices (id),
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
create index on public.subscriptions (user_id);
create index on public.subscriptions (price_id);

alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.prices enable row level security;
alter table public.subscriptions enable row level security;

-- Read own only (no write policies => clients cannot write; webhook uses service role).
create policy "customers: select own"
  on public.customers for select to authenticated
  using (user_id = (select auth.uid()));

create policy "subscriptions: select own"
  on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

-- Public catalog: anyone may read products/prices (e.g. a pricing page).
create policy "products: read all"
  on public.products for select to authenticated, anon
  using (true);
create policy "prices: read all"
  on public.prices for select to authenticated, anon
  using (true);
