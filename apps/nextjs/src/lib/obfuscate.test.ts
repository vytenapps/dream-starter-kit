import { describe, expect, it } from "vitest";

import { obfuscateText } from "./obfuscate";

describe("obfuscateText", () => {
  const sample =
    "Owner-operators in the SaaS space (1–20 staff) pay $39.99/mo!";

  it("preserves length", () => {
    expect(obfuscateText(sample)).toHaveLength(sample.length);
  });

  it("preserves character category position-by-position", () => {
    const out = obfuscateText(sample);
    const cat = (ch: string) =>
      ch >= "a" && ch <= "z"
        ? "lower"
        : ch >= "A" && ch <= "Z"
          ? "upper"
          : ch >= "0" && ch <= "9"
            ? "digit"
            : "other";
    [...sample].forEach((ch, i) => {
      expect(cat(out.charAt(i))).toBe(cat(ch));
    });
  });

  it("leaves whitespace, punctuation and symbols untouched", () => {
    const out = obfuscateText(sample);
    [...sample].forEach((ch, i) => {
      if (!/[a-zA-Z0-9]/.test(ch)) expect(out.charAt(i)).toBe(ch);
    });
  });

  it("actually scrambles the letters (not the identity)", () => {
    const long = "the quick brown fox jumps over the lazy dog".repeat(4);
    expect(obfuscateText(long)).not.toBe(long);
  });

  it("handles empty input", () => {
    expect(obfuscateText("")).toBe("");
  });
});
