import { describe, expect, it } from "vitest";

import { truncateRichText } from "./rich-text-teaser";

const body = (n: number) => ({
  root: {
    type: "root",
    children: Array.from({ length: n }, (_, i) => ({
      type: "paragraph",
      i,
    })),
  },
});

describe("truncateRichText", () => {
  it("keeps only the first maxBlocks top-level nodes", () => {
    const out = truncateRichText(body(10), 3) as {
      root: { children: unknown[] };
    };
    expect(out.root.children).toHaveLength(3);
  });

  it("returns the input unchanged when already at/under the limit", () => {
    const b = body(2);
    expect(truncateRichText(b, 3)).toBe(b);
  });

  it("passes through non-Lexical / empty values untouched", () => {
    expect(truncateRichText(null)).toBeNull();
    expect(truncateRichText("x")).toBe("x");
    expect(truncateRichText({ foo: 1 })).toEqual({ foo: 1 });
  });
});
