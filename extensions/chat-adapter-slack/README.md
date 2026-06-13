# @acme/ext-chat-adapter-slack

Answers in Slack with the AI Chat bot brain (`@acme/ext-chat`). A
signature-verified Events-API webhook normalizes mentions + DMs, runs them
through `handleChannelMessage()` (universal prompt + channel sub-prompts + skill
routing), and replies via `chat.postMessage`.

## Setup

1. Create a Slack app (https://api.slack.com/apps → from manifest) using
   `slack-app-manifest.json` in this folder, or set the scopes/events manually:
   - **Bot scopes:** `app_mentions:read`, `chat:write`, `channels:history`,
     `channels:read`, `groups:history`, `groups:read`, `im:history`, `im:read`,
     `mpim:history`, `mpim:read`, `reactions:read`, `reactions:write`,
     `users:read`.
   - **Event subscriptions:** `app_mention`, `message.channels`,
     `message.groups`, `message.im`, `message.mpim`.
   - **Request URL:** `https://<your-host>/api/ext/chat-adapter-slack/webhook`.
2. Install the app to your workspace and copy the Bot User OAuth token.
3. Set env: `SLACK_BOT_TOKEN` (xoxb-…) and `SLACK_SIGNING_SECRET`.
4. The adapter is enabled by default — toggle it under **Extensions → Slack
   Adapter Settings** in `/admin`.

## Channel sub-prompts

Add a `channels: [slack]` entry under **AI Chat Settings → Universal Prompt →
Channel sub-prompts** to give Slack replies a distinct voice (e.g. terser,
mrkdwn-friendly).

## Out of scope

Socket mode and multi-workspace OAuth. This is webhook + single-workspace. To
use the official `@chat-adapter/slack` package instead of the manual handler,
hand the raw `Request` to its webhook handler in `src/server/index.ts` — the
normalize → `handleChannelMessage` → reply shape is identical.
