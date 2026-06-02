-- Seed data for local dev. Runs after migrations on `supabase db reset`.
-- Creates TWO demo users (so RLS cross-user isolation is testable) plus demo
-- domain data, a tiny Stripe catalog, and one active subscription.
--
-- Demo logins (local only):
--   user.a@example.com / password123   (id 1111…)  — has an active subscription
--   user.b@example.com / password123   (id 2222…)
--
-- NOTE: directly seeding auth.users is a local-dev convenience. In real apps,
-- users are created through Supabase Auth. The handle_new_user() trigger mirrors
-- each into public.profiles automatically.

-- ----------------------------------------------------------------------------
-- Auth users (+ email identities) — standard Supabase local seed pattern.
-- ----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated', 'user.a@example.com',
    extensions.crypt('password123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"User A"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', 'user.b@example.com',
    extensions.crypt('password123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"User B"}',
    now(), now(), '', '', '', ''
  )
on conflict (id) do nothing;

insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    '{"sub":"11111111-1111-1111-1111-111111111111","email":"user.a@example.com","email_verified":true}',
    'email', now(), now(), now()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    '{"sub":"22222222-2222-2222-2222-222222222222","email":"user.b@example.com","email_verified":true}',
    'email', now(), now(), now()
  )
on conflict (provider_id, provider) do nothing;

-- ----------------------------------------------------------------------------
-- Domain data — a personal project + items for each user.
-- ----------------------------------------------------------------------------
insert into public.projects (id, owner_id, org_id, name)
values
  ('aaaa0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', null, 'User A · Personal'),
  ('bbbb0000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', null, 'User B · Personal')
on conflict (id) do nothing;

insert into public.items (project_id, created_by, title, status, data)
values
  ('aaaa0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'A''s first item', 'open', '{"note":"belongs to A"}'),
  ('aaaa0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'A''s second item', 'done', '{}'),
  ('bbbb0000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'B''s first item', 'open', '{"note":"belongs to B"}')
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Engagement + chat demo rows.
-- ----------------------------------------------------------------------------
insert into public.notifications (user_id, type, title, body)
values
  ('11111111-1111-1111-1111-111111111111', 'welcome', 'Welcome, User A', 'Your starter kit is ready.'),
  ('22222222-2222-2222-2222-222222222222', 'welcome', 'Welcome, User B', 'Your starter kit is ready.')
on conflict do nothing;

insert into public.chat_threads (id, user_id, title)
values
  ('cccc0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'A''s first chat')
on conflict (id) do nothing;

insert into public.chat_messages (thread_id, role, content)
values
  ('cccc0000-0000-0000-0000-000000000001', 'user', 'Hello!'),
  ('cccc0000-0000-0000-0000-000000000001', 'assistant', 'Hi User A — how can I help?')
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Stripe catalog (mirrors what the webhook would sync) + one active sub for A.
-- ----------------------------------------------------------------------------
-- A single "Pro" product with two prices: Monthly $9.99 and Yearly $99.
insert into public.products (id, active, name, description)
values ('prod_pro', true, 'Pro', 'Unlock premium features')
on conflict (id) do nothing;

insert into public.prices (id, product_id, active, unit_amount, currency, type, interval, interval_count)
values
  ('price_pro_monthly', 'prod_pro', true, 999, 'usd', 'recurring', 'month', 1),
  ('price_pro_yearly', 'prod_pro', true, 9900, 'usd', 'recurring', 'year', 1)
on conflict (id) do nothing;

insert into public.customers (user_id, stripe_customer_id)
values ('11111111-1111-1111-1111-111111111111', 'cus_demo_a')
on conflict (user_id) do nothing;

-- User A has an active monthly subscription (demonstrates premium gating).
insert into public.subscriptions (id, user_id, price_id, status, current_period_end)
values ('sub_demo_a', '11111111-1111-1111-1111-111111111111', 'price_pro_monthly', 'active', now() + interval '30 days')
on conflict (id) do nothing;
