-- AI Chat extension · bot-brain skill routing
-- Per-thread "active skill" state powers routing stickiness: once a skill is
-- selected it stays active for a few turns unless a clearly stronger candidate
-- appears. The skill itself lives in the CMS (ext-chat-skills collection), so
-- we store its slug, not a uuid. Reattach-friendly (idempotent add column).

alter table public.ext_chat_threads
  add column if not exists active_skill_slug text,
  add column if not exists active_skill_turns_remaining int not null default 0;
