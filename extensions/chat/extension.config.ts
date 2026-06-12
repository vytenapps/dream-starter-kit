import { defineExtension } from "@acme/ext-kit";

/**
 * AI Chat — persisted assistant threads. The streaming endpoint is served by
 * the extension dispatcher (POST /api/ext/chat/stream — authed +
 * rate-limited); the model id stays centralized in @acme/config (golden rule
 * #5) while the system prompt + history window are runtime-tunable from the
 * admin settings screen (§1.7).
 */
export default defineExtension({
  slug: "chat",
  name: "AI Chat",
  version: "1.0.0",
  kitCompat: ">=1.0.0 <2",
  description: "AI assistant with persisted chat threads.",
  nav: {
    web: [
      { title: "Chat", href: "/x/chat", icon: "IconMessageCircle", order: 20 },
    ],
    native: [
      { title: "Chat", href: "/x/chat", icon: "IconMessageCircle", order: 20 },
    ],
  },
  routes: {
    web: [
      { path: "", component: "ChatListPage" },
      { path: "[threadId]", component: "ChatThreadPage" },
    ],
    native: [
      { path: "", component: "ChatListScreen" },
      { path: "[threadId]", component: "ChatThreadScreen" },
    ],
  },
  widgets: { web: "ChatWidget", native: "ChatWidget" },
  server: {
    routes: true,
  },
  database: {
    tables: ["ext_chat_threads", "ext_chat_messages"],
  },
  cms: {
    hasSettings: true,
    hasMigrations: true,
  },
});
