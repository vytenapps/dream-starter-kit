-- ============================================================================
-- chat-uploads bucket — per-user chat attachments (images sent to the AI).
--
-- Owned by the HOST, not the chat extension: extension SQL may not touch the
-- storage schema (lintExtensionSql), so the bucket + object policies live
-- here — the same split as cms-media / extension-uploads. Private bucket;
-- objects are written under <user_id>/<filename> and read back via
-- short-lived signed URLs minted by the chat extension's upload route.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-uploads',
  'chat-uploads',
  false,
  5242880, -- 5 MiB (matches the upload route's cap)
  array['image/png', 'image/jpeg']
)
on conflict (id) do nothing;

-- Owner-folder policies: an authenticated user may write/read only objects
-- whose first path segment is their own user id.
drop policy if exists "chat-uploads: insert own folder" on storage.objects;
create policy "chat-uploads: insert own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "chat-uploads: read own folder" on storage.objects;
create policy "chat-uploads: read own folder"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "chat-uploads: delete own folder" on storage.objects;
create policy "chat-uploads: delete own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'chat-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
