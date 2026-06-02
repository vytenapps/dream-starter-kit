import { describe, expect, it } from "vitest";

import {
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  updateProfileSchema,
} from "./auth";

describe("auth validators", () => {
  it("accepts a valid sign-in", () => {
    expect(
      signInSchema.safeParse({ email: "a@b.com", password: "x" }).success,
    ).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(
      signInSchema.safeParse({ email: "nope", password: "x" }).success,
    ).toBe(false);
  });

  it("requires an 8+ char password on sign-up", () => {
    expect(
      signUpSchema.safeParse({ email: "a@b.com", password: "short" }).success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({ email: "a@b.com", password: "longenough" })
        .success,
    ).toBe(true);
  });

  it("rejects mismatched password confirmation", () => {
    const res = resetPasswordSchema.safeParse({
      password: "longenough",
      confirmPassword: "different",
    });
    expect(res.success).toBe(false);
  });

  it("allows an empty avatar URL but rejects a malformed one", () => {
    expect(
      updateProfileSchema.safeParse({ displayName: "A", avatarUrl: "" })
        .success,
    ).toBe(true);
    expect(
      updateProfileSchema.safeParse({ displayName: "A", avatarUrl: "x" })
        .success,
    ).toBe(false);
  });
});
