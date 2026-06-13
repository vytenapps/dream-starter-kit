import { defineExtension } from "@acme/ext-kit";

/**
 * Sendblue (iMessage/SMS) channel adapter — lets the AI Chat bot brain answer
 * over iMessage/SMS. A secret-verified webhook
 * (POST /api/ext/chat-adapter-sendblue/webhook) normalizes inbound messages
 * (incl. voice memos → transcription) and calls ext-chat's
 * handleChannelMessage(), then replies via the Sendblue send API with STOP/HELP
 * compliance + a daily outbound quota. No tables of its own (channel state
 * lives in ext-chat); requires the chat extension. Built to the Chat SDK
 * adapter shape (chat-sdk.dev/adapters/community/sendblue) so the official
 * chat-adapter-sendblue package can be dropped in later.
 */
export default defineExtension({
  slug: "chat-adapter-sendblue",
  name: "Sendblue Adapter",
  version: "1.0.0",
  kitCompat: ">=1.0.0 <2",
  description: "Answer over iMessage/SMS with the AI chat bot brain.",
  requires: ["chat"],
  nav: {},
  server: {
    publicRoutes: true,
  },
  database: {
    tables: [],
  },
  cms: {
    hasSettings: true,
    hasMigrations: true,
  },
});
