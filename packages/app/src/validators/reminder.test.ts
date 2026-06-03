import { describe, expect, it } from "vitest";

import { createReminderSchema } from "./reminder";

describe("reminder validators", () => {
  it("accepts a valid reminder", () => {
    const result = createReminderSchema.safeParse({
      dueAt: "2030-01-01T10:00",
      channel: "push",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty due date", () => {
    expect(
      createReminderSchema.safeParse({ dueAt: "", channel: "push" }).success,
    ).toBe(false);
  });

  it("rejects an unknown channel", () => {
    expect(
      createReminderSchema.safeParse({
        dueAt: "2030-01-01T10:00",
        channel: "fax",
      }).success,
    ).toBe(false);
  });
});
