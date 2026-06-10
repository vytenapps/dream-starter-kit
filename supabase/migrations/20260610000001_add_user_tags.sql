-- ============================================================================
-- User tags
-- A tagging system for users. `tags` holds reusable tag definitions; `user_tags`
-- links a user to a tag. Tags are assigned automatically (e.g. a plan-name tag
-- when a subscription becomes active — written by the Stripe webhook with the
-- service role) and managed manually by staff (via a server-only admin endpoint
-- that also uses the service role). Regular users may only READ their own tags.
-- ============================================================================

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text, -- optional hex/utility color for the badge
  -- System tags are managed by the app (e.g. plan-name tags from billing) and
  -- shouldn't be hand-edited/deleted in the admin UI.
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.user_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, tag_id)
);
-- FK indexes (every FK used in an RLS predicate / join needs one).
create index on public.user_tags (user_id);
create index on public.user_tags (tag_id);

alter table public.tags enable row level security;
alter table public.user_tags enable row level security;

-- Tag definitions are readable by any signed-in user (so the app can render a
-- user's tag names/colors). Writes are service-role only (no policy granted).
create policy "tags: read for authenticated"
  on public.tags for select to authenticated
  using (true);

-- A user may read only their own tag links. Writes are service-role only
-- (the webhook auto-tags by plan; staff manage tags via an admin endpoint).
create policy "user_tags: select own"
  on public.user_tags for select to authenticated
  using (user_id = (select auth.uid()));
