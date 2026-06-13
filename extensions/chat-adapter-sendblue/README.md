# @acme/ext-chat-adapter-sendblue

Answers over iMessage/SMS with the AI Chat bot brain (`@acme/ext-chat`). A
secret-verified webhook normalizes inbound messages (transcribing voice memos
via the chat extension's Whisper integration when `OPENAI_API_KEY` is set),
runs them through `handleChannelMessage()` (which applies STOP/HELP compliance

- a daily outbound quota), and replies via the Sendblue send API.

## Setup

1. In your Sendblue dashboard, point the inbound webhook at
   `https://<your-host>/api/ext/chat-adapter-sendblue/webhook`.
2. Set env: `SENDBLUE_API_KEY`, `SENDBLUE_API_SECRET`, `SENDBLUE_FROM_NUMBER`
   (E.164), and optionally `SENDBLUE_WEBHOOK_SECRET` (recommended — sent as the
   `sb-signing-secret` header) and `SENDBLUE_STATUS_CALLBACK_URL`.
3. Toggle the adapter + set the daily outbound quota under **Extensions →
   Sendblue Adapter Settings** in `/admin`.

## Compliance + quotas

STOP/UNSUBSCRIBE opts a contact out (HELP/START re-subscribes); the daily
per-from-number outbound quota is enforced in `handleChannelMessage`. Voice
memos are transcribed before hitting the model.

## Channel sub-prompts

Add a `channels: [sms-sendblue]` entry under **AI Chat Settings → Universal
Prompt → Channel sub-prompts** to keep texts short and link-light.

To use the official `chat-adapter-sendblue` package instead of the manual
parser, hand the raw `Request` to `chat.webhooks.sendblue(req)` in
`src/server/index.ts` — the normalize → `handleChannelMessage` → reply shape is
identical.
