-- 0001 · Identity
-- profiles: app-level user record, 1:1 with auth.users (same id). The anchor
-- for most RLS policies. Created by a trigger on signup. (docs/ERD.md)

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'App-level user record, 1:1 with auth.users (same id). Created by handle_new_user() on signup.';

-- Mirror auth.users -> profiles on signup. SECURITY DEFINER so it can insert
-- regardless of RLS; empty search_path is the Supabase security best practice
-- (every reference is schema-qualified).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: a user sees/updates only their own profile. Inserts happen via the
-- trigger (SECURITY DEFINER); deletes cascade from auth.users.
alter table public.profiles enable row level security;

create policy "profiles: select own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
