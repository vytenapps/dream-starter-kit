import { defineExtension } from "@acme/ext-kit";

/**
 * Slack channel adapter — lets the AI Chat bot brain answer in Slack. A
 * signature-verified Events-API webhook (POST /api/ext/chat-adapter-slack/webhook)
 * normalizes mentions + DMs and calls ext-chat's handleChannelMessage(), then
 * replies via chat.postMessage. No tables of its own (channel state lives in
 * ext-chat); requires the chat extension. See README.md for the Slack app
 * manifest + scopes. Built to the Chat SDK adapter shape
 * (chat-sdk.dev/adapters/official/slack) so the official @chat-adapter/slack
 * package can be dropped in later.
 */
export default defineExtension({
  slug: "chat-adapter-slack",
  name: "Slack Adapter",
  version: "1.0.0",
  kitCompat: ">=1.0.0 <2",
  description: "Answer in Slack with the AI chat bot brain.",
  requires: ["chat"],
  nav: {},
  server: {
    publicRoutes: true,
  },
  database: {
    tables: [],
  },
  cms: {
    // Contributes a "Slack" tab to the AI Chat settings global (target: chat)
    // instead of owning a standalone settings screen.
    settingsTabFor: "chat",
    hasMigrations: true,
  },
});
