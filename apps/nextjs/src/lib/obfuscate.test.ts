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

  it("scrambles non-ASCII letters and digits (no passthrough)", () => {
    // Accented Latin, Cyrillic, Greek, CJK, full-width digits — none may survive.
    for (const s of [
      "café résumé",
      "Привет мир",
      "Καλημέρα",
      "日本語のテスト",
      "１２３４",
    ]) {
      const out = obfuscateText(s);
      expect(out).toHaveLength([...s].length);
      // No original letter/number code point remains in place.
      [...s].forEach((ch, i) => {
        if (/[\p{L}\p{N}]/u.test(ch)) {
          // The replacement is ASCII a-z/A-Z/0-9, so a non-ASCII original is gone.
          if (!/[a-zA-Z0-9]/.test(ch)) {
            expect(/[a-zA-Z0-9]/.test(out.charAt(i))).toBe(true);
          }
        } else {
          expect(out.charAt(i)).toBe(ch); // punctuation/space untouched
        }
      });
      expect(out).not.toBe(s);
    }
  });

  it("preserves case for accented letters", () => {
    // "Ñ" is uppercase → uppercase ASCII; "é" is lowercase → lowercase ASCII.
    const out = obfuscateText("Ñé");
    expect(/[A-Z]/.test(out.charAt(0))).toBe(true);
    expect(/[a-z]/.test(out.charAt(1))).toBe(true);
  });

  it("leaves emoji and symbols untouched", () => {
    const s = "hi 🚀 €5";
    const out = obfuscateText(s);
    expect(out).toContain("🚀");
    expect(out).toContain("€");
    expect(out).toContain(" ");
  });
});
