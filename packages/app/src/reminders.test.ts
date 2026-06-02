import { describe, expect, it } from "vitest";

import { isReminderDue, selectDueReminders } from "./reminders";

const now = new Date("2026-06-01T12:00:00Z");

describe("reminder due selection", () => {
  it("is due when pending and due_at <= now", () => {
    expect(
      isReminderDue({ status: "pending", due_at: "2026-06-01T11:00:00Z" }, now),
    ).toBe(true);
  });

  it("is not due when scheduled in the future", () => {
    expect(
      isReminderDue({ status: "pending", due_at: "2026-06-01T13:00:00Z" }, now),
    ).toBe(false);
  });

  it("ignores reminders that are already sent", () => {
    expect(
      isReminderDue({ status: "sent", due_at: "2026-06-01T11:00:00Z" }, now),
    ).toBe(false);
  });

  it("selectDueReminders returns only pending+due", () => {
    const list = [
      { id: "a", status: "pending", due_at: "2026-06-01T11:00:00Z" },
      { id: "b", status: "pending", due_at: "2026-06-01T13:00:00Z" },
      { id: "c", status: "sent", due_at: "2026-06-01T10:00:00Z" },
    ];
    expect(selectDueReminders(list, now).map((r) => r.id)).toEqual(["a"]);
  });
});
