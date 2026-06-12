import { defineExtension } from "@acme/ext-kit";

/**
 * Notifications — the kit's shared notification service (in-app feed + Expo
 * push). Other extensions `require` it: import its client hooks / server
 * `notify()` API, or (from Deno edge functions) follow the documented SQL
 * contract — insert into ext_notifications, read ext_notifications_push_tokens.
 */
export default defineExtension({
  slug: "notifications",
  name: "Notifications",
  version: "1.0.0",
  kitCompat: ">=1.0.0 <2",
  description:
    "In-app notification feed and Expo push delivery — the shared service other extensions build on.",
  database: {
    tables: ["ext_notifications", "ext_notifications_push_tokens"],
  },
});
