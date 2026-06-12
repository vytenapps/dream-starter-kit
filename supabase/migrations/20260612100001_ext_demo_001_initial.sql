-- Demo extension · initial schema (owner-scoped, canonical RLS pattern).
create table if not exists public.ext_demo_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);
create index if not exists ext_demo_items_user_id_idx on public.ext_demo_items (user_id);

alter table public.ext_demo_items enable row level security;

drop policy if exists "ext_demo_items: own" on public.ext_demo_items;
create policy "ext_demo_items: own"
  on public.ext_demo_items for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
