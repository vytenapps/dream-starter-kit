import { defineExtension } from "@acme/ext-kit";

/**
 * Reminders — scheduled nudges. The `reminders-process` edge function (run on
 * a schedule via pg_cron or an external trigger) finds due reminders, then
 * fans out through the notifications extension via its documented SQL
 * contract: insert into ext_notifications + read ext_notifications_push_tokens
 * (declared below via requires + database.dml).
 */
export default defineExtension({
  slug: "reminders",
  name: "Reminders",
  version: "1.0.0",
  kitCompat: ">=1.0.0 <2",
  description: "Scheduled reminders with push + in-app delivery.",
  requires: ["notifications"],
  nav: {
    web: [
      {
        title: "Reminders",
        href: "/a/reminders",
        icon: "IconClock",
        order: 30,
      },
    ],
    native: [
      {
        title: "Reminders",
        href: "/a/reminders",
        icon: "IconClock",
        order: 30,
      },
    ],
  },
  routes: {
    web: [{ path: "", component: "RemindersPage" }],
    native: [{ path: "", component: "RemindersScreen" }],
  },
  database: {
    tables: ["ext_reminders"],
    dml: ["ext_notifications", "ext_notifications_push_tokens"],
  },
  widgets: { web: "RemindersWidget", native: "RemindersWidget" },
  server: {
    edgeFunctions: ["reminders-process"],
  },
});
