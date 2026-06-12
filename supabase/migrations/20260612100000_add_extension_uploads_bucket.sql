-- Private bucket for admin-uploaded extension zips (docs/EXTENSIONS-PLAN.md
-- §6). No client policies on purpose: only the server (service role, which
-- bypasses RLS) writes uploads and mints short-lived signed URLs for the
-- extension-ops workflow runner.
insert into storage.buckets (id, name, public)
values ('extension-uploads', 'extension-uploads', false)
on conflict (id) do nothing;
