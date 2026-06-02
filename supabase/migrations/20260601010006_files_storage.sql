-- 0006 · Files + Storage
-- `files` is metadata for objects in Supabase Storage. The bucket's RLS lives on
-- storage.objects, path-prefixed by user id (convention: "<user_id>/..."),
-- mirroring the files table's ownership. (docs/ERD.md)

create table public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid references public.items (id) on delete set null, -- nullable: not attached to an item
  bucket text not null default 'user-files',
  path text not null, -- Storage object path, e.g. "<user_id>/avatar.png"
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);
create index on public.files (user_id);
create index on public.files (item_id);

alter table public.files enable row level security;

create policy "files: own"
  on public.files for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Private bucket for user uploads.
insert into storage.buckets (id, name, public)
values ('user-files', 'user-files', false)
on conflict (id) do nothing;

-- Storage RLS: a user may only touch objects under their own "<user_id>/" prefix.
create policy "user-files: select own"
  on storage.objects for select to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "user-files: insert own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "user-files: update own"
  on storage.objects for update to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "user-files: delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
