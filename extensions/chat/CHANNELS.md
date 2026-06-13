# Chat channels — adding an adapter

The chat extension exposes a channel framework so the AI bot brain (universal
prompt + channel sub-prompts + skill routing) can answer on any chat platform,
not just the in-app `/a/chat`. Each platform is its own extension:
`ext-chat-adapter-<channel>` (see `extensions/chat-adapter-slack` and
`extensions/chat-adapter-sendblue` for the two shipped examples).

## The contract

`@acme/ext-chat/server` exports `handleChannelMessage(params, messageHandle?)`.
It dedupes (by `messageHandle`), upserts contact/thread state, applies STOP/HELP
compliance + a daily quota, composes the channel-aware system prompt, generates
a buffered reply, and persists the turn + skill stickiness. Channel state lives
in service-path tables (`ext_chat_channel_*`) read via the service-role client —
webhooks have no user session.

## Recipe for a new channel (chat-sdk.dev/adapters)

1. `pnpm ext create chat-adapter-<channel>` and trim to a server-only extension
   (no web/native routes; `server.publicRoutes: true`; `requires: ["chat"]`).
2. Add the platform's `@chat-adapter/*` package (or implement the webhook
   verify/normalize/send by hand, as the Slack + Sendblue adapters do).
3. In `src/server/index.ts`, expose `publicRoutes["POST /webhook"]`: verify the
   signature, normalize inbound to `{ text, threadKey, contactKey }`, then call
   `handleChannelMessage({ channel: "<slug>", … })` and send `replyText` back.
4. Use a `CHAT_CHANNELS` slug from `@acme/config` for `channel` — that slug then
   automatically picks up channel-scoped Universal sub-prompts and skill
   routing. Add new slugs to `CHAT_CHANNELS` as you add channels.
5. Add optional env vars (zod schema + `.env.example` + `turbo.json`) and a
   settings toggle, then `pnpm ext sync` + `pnpm ext payload-migrate <slug>`.
