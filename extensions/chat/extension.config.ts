import { defineExtension } from "@acme/ext-kit";

/**
 * AI Chat — persisted assistant threads. The streaming endpoint moves behind
 * the extension dispatcher (POST /api/ext/chat/stream) in phase 5 of the
 * refactor; the model id stays centralized in @acme/config (golden rule #5).
 */
export default defineExtension({
  slug: "chat",
  name: "AI Chat",
  version: "1.0.0",
  kitCompat: ">=1.0.0 <2",
  description: "AI assistant with persisted chat threads.",
  database: {
    tables: ["ext_chat_threads", "ext_chat_messages"],
  },
});
