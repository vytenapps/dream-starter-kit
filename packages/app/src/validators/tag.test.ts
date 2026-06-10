import { describe, expect, it } from "vitest";

import { createTagSchema } from "./tag";

describe("tag validators", () => {
  it("accepts a valid tag", () => {
    expect(
      createTagSchema.safeParse({ name: "VIP", color: "#10b981" }).success,
    ).toBe(true);
  });

  it("accepts a tag without a color", () => {
    expect(createTagSchema.safeParse({ name: "Free" }).success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(createTagSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects an over-long name", () => {
    expect(
      createTagSchema.safeParse({ name: "x".repeat(51) }).success,
    ).toBe(false);
  });
});
