-- AI Chat extension · channel framework (Sendblue / Slack / future adapters)
-- Conversations arriving over external channels have no auth user and no
-- session, so these tables are SERVICE-PATH ONLY: RLS is enabled with zero
-- policies, which denies all anon/authenticated access — only the server's
-- service-role client (which bypasses RLS) reads/writes them. This is the
-- dream-app concierge pattern and is allowed for channel state that no RLS
-- client ever consumes directly.

create table if not exists public.ext_chat_channel_contacts (
  channel       text not null,
  contact_key   text not null,
  user_id       uuid references public.profiles (id) on delete set null,
  display_name  text,
  opted_out     boolean not null default false,
  created_at    timestamptz not null default now(),
  primary key (channel, contact_key)
);

create table if not exists public.ext_chat_channel_threads (
  channel                      text not null,
  thread_key                   text not null,
  contact_key                  text,
  messages                     jsonb not null default '[]'::jsonb,
  active_skill_slug            text,
  active_skill_turns_remaining int not null default 0,
  is_group                     boolean not null default false,
  updated_at                   timestamptz not null default now(),
  primary key (channel, thread_key)
);

create table if not exists public.ext_chat_processed_inbound (
  message_handle text primary key,
  channel        text not null,
  received_at    timestamptz not null default now()
);

create table if not exists public.ext_chat_outbound_counters (
  sender text not null,
  day    date not null,
  count  int  not null default 0,
  primary key (sender, day)
);

alter table public.ext_chat_channel_contacts   enable row level security;
alter table public.ext_chat_channel_threads    enable row level security;
alter table public.ext_chat_processed_inbound  enable row level security;
alter table public.ext_chat_outbound_counters  enable row level security;
-- Intentionally no policies: service-role only.
