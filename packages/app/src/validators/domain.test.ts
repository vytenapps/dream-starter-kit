import { describe, expect, it } from "vitest";

import { createItemSchema } from "./item";
import { createProjectSchema } from "./project";

describe("project validators", () => {
  it("requires a non-empty name", () => {
    expect(createProjectSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createProjectSchema.safeParse({ name: "My project" }).success).toBe(
      true,
    );
  });
});

describe("item validators", () => {
  it("requires a title and a status", () => {
    // status is required by the schema (forms supply the "open" default)
    expect(createItemSchema.safeParse({ title: "Task" }).success).toBe(false);
    expect(
      createItemSchema.safeParse({ title: "Task", status: "open" }).success,
    ).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(createItemSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("rejects an invalid status", () => {
    expect(
      createItemSchema.safeParse({ title: "X", status: "bogus" }).success,
    ).toBe(false);
  });
});
