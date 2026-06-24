-- Anonymous-account-first identity + checkout linking.
--
-- Gives every visitor a real auth.uid() early (a Supabase anonymous user, minted
-- on first action — e.g. favoriting any content), so checkout always links to an
-- account and converts to a permanent user once an email is known. See
-- docs/ARCHITECTURE.md and docs/TURNSTILE.md. Append-only + idempotent-friendly.
--
-- Sections: profiles (anon flag, phone) · handle_new_user guard · content_favorites
-- (the one table anon users may write) · anon-exclusion on cost-bearing AI tables.

-- ============================================================================
-- profiles: track anonymity + capture phone from wallet checkout
-- ============================================================================

alter table public.profiles
  add column if not exists is_anonymous boolean not null default false;
alter table public.profiles
  add column if not exists phone text;

comment on column public.profiles.is_anonymous is
  'True for Supabase anonymous users (minted on first action). Never staff; converted to permanent on email confirmation.';

-- Let owners save their phone (captured from Apple/Google Pay) — same column-level
-- grant pattern as display_name/avatar_url. is_staff/is_anonymous stay server-only.
grant update (phone) on public.profiles to authenticated;

-- handle_new_user, hardened for anonymous users: an anon signup is NEVER staff,
-- and the "first user becomes founder/admin" rule counts only NON-anonymous
-- profiles (so a bot's anonymous sign-in can't claim the founder slot).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, is_anonymous, is_staff)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(new.is_anonymous, false),
    -- First NON-anonymous profile becomes staff (the founder/admin); anon never.
    (not coalesce(new.is_anonymous, false))
      and (select count(*) = 0 from public.profiles where is_anonymous = false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ============================================================================
-- content_favorites: per-user saves across ALL content collections. The ONLY
-- table anonymous users may write. Content lives in the cms schema, so the item
-- is referenced by its Payload collection slug + doc id (no FK).
-- ============================================================================

create table if not exists public.content_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  collection text not null,            -- Payload collection slug (posts/videos/audio/…)
  item_id text not null,               -- content doc id (cms schema → no FK)
  created_at timestamptz not null default now(),
  unique (user_id, collection, item_id)
);
create index if not exists content_favorites_user_id_idx
  on public.content_favorites (user_id);

alter table public.content_favorites enable row level security;

drop policy if exists "content_favorites: own" on public.content_favorites;
create policy "content_favorites: own"
  on public.content_favorites for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ============================================================================
-- Anon-exclusion on cost-bearing AI tables (defense in depth).
-- Anonymous users carry role=authenticated, so they'd otherwise inherit the
-- existing "own" policies on the AI chat tables and could burn AI compute.
-- A RESTRICTIVE policy is AND-ed with the permissive ones, so it blocks anon
-- writes/reads regardless of how the chat policies evolve. The AI route should
-- also reject anon sessions server-side.
-- ============================================================================

drop policy if exists "ext_chat_threads: no anon" on public.ext_chat_threads;
create policy "ext_chat_threads: no anon"
  on public.ext_chat_threads as restrictive for all to authenticated
  using (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false)
  with check (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);

drop policy if exists "ext_chat_messages: no anon" on public.ext_chat_messages;
create policy "ext_chat_messages: no anon"
  on public.ext_chat_messages as restrictive for all to authenticated
  using (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false)
  with check (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);
