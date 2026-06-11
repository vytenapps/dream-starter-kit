-- ============================================================================
-- cms-media bucket — Payload CMS media storage (public-read).
--
-- Locally this bucket already exists via supabase/config.toml
-- ([storage.buckets.cms-media]), so this is a no-op there. On a hosted project
-- config.toml doesn't apply; this migration provisions the bucket so the
-- runtime DB bootstrap (or `supabase db push`) covers it and no manual
-- dashboard step is needed. Values mirror config.toml: public-read, 50 MiB,
-- same MIME allowlist. S3 access keys remain a dashboard step (they're
-- credentials, not schema).
--
-- Public-read is intentional: published content is served on public pages +
-- mobile. Per-user private uploads belong in the RLS-governed `user-files`
-- bucket (see 20260609000001_initial.sql), never here.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cms-media',
  'cms-media',
  true,
  52428800, -- 50 MiB, matching config.toml's "50MiB"
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'video/mp4', 'audio/mpeg']
)
on conflict (id) do nothing;
