-- Extend the anonymous-write block to the remaining cost- / notification-bearing
-- tables (golden rule #1: content_favorites is the ONLY table anon users may write).
--
-- 20260624000000_anon_identity.sql added a RESTRICTIVE "no anon" policy to
-- ext_chat_threads + ext_chat_messages, but the other AI-chat SDK tables plus the
-- reminders + notifications tables and the core `files` table still carried only
-- their permissive `for all to authenticated` owner policies. Anonymous users
-- hold role=authenticated, so they inherited those and could write rows —
-- notably ext_reminders / ext_notifications_push_tokens, which are
-- push-notification-bearing and were the substrate for unconsented data grafting
-- via anon reconciliation.
--
-- A RESTRICTIVE policy is AND-ed with the permissive ones, so it blocks anon
-- reads/writes regardless of how each table's owner policy evolves. Append-only,
-- idempotent (drop-if-exists), and guarded by to_regclass so removing an
-- extension (which drops its tables) can't break this migration.

do $$
declare
  t text;
  tables text[] := array[
    -- reminders + notifications (push-bearing / user-owned state)
    'ext_reminders',
    'ext_notifications',
    'ext_notifications_push_tokens',
    -- remaining AI-chat SDK tables (threads + messages already blocked)
    'ext_chat_documents',
    'ext_chat_suggestions',
    'ext_chat_votes',
    -- core user uploads (storage-bearing)
    'files'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on public.%I', t || ': no anon', t);
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated '
        'using (coalesce(((select auth.jwt()) ->> ''is_anonymous'')::boolean, false) = false) '
        'with check (coalesce(((select auth.jwt()) ->> ''is_anonymous'')::boolean, false) = false)',
        t || ': no anon', t
      );
    end if;
  end loop;
end $$;
