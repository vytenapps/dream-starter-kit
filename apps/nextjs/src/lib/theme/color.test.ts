import { describe, expect, it } from "vitest";

import {
  bestForeground,
  contrast,
  formatOklch,
  formatOklchAlpha,
  hexToOklch,
  luminance,
  mix,
  oklchToHex,
  parseOklch,
  rotateHue,
  toHex,
  toOklchString,
  withL,
} from "./color";

const WHITE = hexToOklch("#ffffff");
const BLACK = hexToOklch("#000000");

/** Compare two hex colors channel-by-channel within a small tolerance. */
function expectHexClose(actual: string, expected: string, tol = 2) {
  const channels = (hex: string) => {
    const n = hex.replace("#", "");
    return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  };
  const a = channels(actual);
  const e = channels(expected);
  for (let i = 0; i < 3; i++) {
    expect(Math.abs((a[i] ?? 0) - (e[i] ?? 0))).toBeLessThanOrEqual(tol);
  }
}

describe("parseOklch", () => {
  it("parses a well-formed oklch() string", () => {
    expect(parseOklch("oklch(0.7 0.2 30)")).toEqual({ l: 0.7, c: 0.2, h: 30 });
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseOklch("  oklch(0.4 0.1 120)  ")).toEqual({
      l: 0.4,
      c: 0.1,
      h: 120,
    });
  });

  it("falls back to mid-grey on malformed input", () => {
    expect(parseOklch("not a color")).toEqual({ l: 0.5, c: 0, h: 0 });
    expect(parseOklch("#ffffff")).toEqual({ l: 0.5, c: 0, h: 0 });
  });
});

describe("formatOklch", () => {
  it("round-trips a parsed value", () => {
    expect(formatOklch({ l: 0.7, c: 0.2, h: 30 })).toBe("oklch(0.7 0.2 30)");
  });

  it("clamps lightness into [0,1]", () => {
    expect(formatOklch({ l: 1.5, c: 0, h: 0 })).toBe("oklch(1 0 0)");
    expect(formatOklch({ l: -0.5, c: 0, h: 0 })).toBe("oklch(0 0 0)");
  });

  it("collapses near-zero chroma to a neutral grey (drops the hue)", () => {
    expect(formatOklch({ l: 0.5, c: 0.0001, h: 200 })).toBe("oklch(0.5 0 0)");
  });

  it("normalizes the hue into [0,360)", () => {
    expect(formatOklch({ l: 0.5, c: 0.1, h: -30 })).toBe("oklch(0.5 0.1 330)");
  });
});

describe("formatOklchAlpha", () => {
  it("appends a clamped alpha channel", () => {
    expect(formatOklchAlpha("#ffffff", 0.5)).toBe("oklch(1 0 0 / 0.5)");
    expect(formatOklchAlpha("#ffffff", 2)).toBe("oklch(1 0 0 / 1)");
    expect(formatOklchAlpha("#ffffff", -1)).toBe("oklch(1 0 0 / 0)");
  });
});

describe("toOklchString", () => {
  it("converts hex to an oklch string", () => {
    expect(toOklchString("#ffffff")).toBe("oklch(1 0 0)");
  });

  it("passes an existing oklch string through unchanged", () => {
    expect(toOklchString("oklch(0.5 0.1 200)")).toBe("oklch(0.5 0.1 200)");
  });
});

describe("hex <-> oklch conversion", () => {
  it("maps pure black and white exactly", () => {
    expect(oklchToHex(hexToOklch("#ffffff"))).toBe("#ffffff");
    expect(oklchToHex(hexToOklch("#000000"))).toBe("#000000");
  });

  it("round-trips saturated colors within tolerance", () => {
    for (const hex of ["#ff0000", "#00ff00", "#0000ff", "#3b82f6", "#7c3aed"]) {
      expectHexClose(oklchToHex(hexToOklch(hex)), hex);
    }
  });

  it("expands 3-char hex before converting", () => {
    expect(oklchToHex(hexToOklch("#fff"))).toBe("#ffffff");
  });

  it("falls back to mid-grey on invalid hex", () => {
    expect(hexToOklch("#zzz")).toEqual({ l: 0.5, c: 0, h: 0 });
  });

  it("oklchToHex accepts an oklch string directly", () => {
    expect(oklchToHex("oklch(1 0 0)")).toBe("#ffffff");
  });
});

describe("toHex", () => {
  it("normalizes a 6-char hex (adding the #)", () => {
    expect(toHex("abcdef")).toBe("#abcdef");
    expect(toHex("#abcdef")).toBe("#abcdef");
  });

  it("expands a 3-char hex", () => {
    expect(toHex("#abc")).toBe("#aabbcc");
  });

  it("converts an oklch string to hex", () => {
    expect(toHex("oklch(1 0 0)")).toBe("#ffffff");
  });
});

describe("mix", () => {
  const a = { l: 0.2, c: 0.05, h: 20 };
  const b = { l: 0.8, c: 0.15, h: 200 };

  it("returns the endpoints at t=0 and t=1", () => {
    expect(mix(a, b, 0)).toEqual(a);
    const end = mix(a, b, 1);
    expect(end.l).toBeCloseTo(b.l);
    expect(end.c).toBeCloseTo(b.c);
    expect(end.h).toBeCloseTo(b.h);
  });

  it("interpolates lightness and chroma at the midpoint", () => {
    const m = mix(a, b, 0.5);
    expect(m.l).toBeCloseTo(0.5);
    expect(m.c).toBeCloseTo(0.1);
  });

  it("takes the short path across the 0/360 hue boundary", () => {
    // 350 -> 10 is +20 (through 0), not -340.
    const m = mix({ l: 0.5, c: 0.1, h: 350 }, { l: 0.5, c: 0.1, h: 10 }, 0.5);
    expect(m.h).toBeCloseTo(0);
  });
});

describe("withL", () => {
  it("replaces lightness and preserves chroma/hue", () => {
    expect(withL({ l: 0.2, c: 0.1, h: 120 }, 0.7)).toEqual({
      l: 0.7,
      c: 0.1,
      h: 120,
    });
  });

  it("clamps the new lightness", () => {
    expect(withL({ l: 0.2, c: 0.1, h: 120 }, 1.5).l).toBe(1);
    expect(withL({ l: 0.2, c: 0.1, h: 120 }, -1).l).toBe(0);
  });
});

describe("rotateHue", () => {
  it("rotates and wraps within [0,360)", () => {
    expect(rotateHue({ l: 0.5, c: 0.1, h: 350 }, 20).h).toBeCloseTo(10);
    expect(rotateHue({ l: 0.5, c: 0.1, h: 10 }, -30).h).toBeCloseTo(340);
  });
});

describe("luminance / contrast / bestForeground", () => {
  it("computes luminance at the extremes", () => {
    expect(luminance(WHITE)).toBeCloseTo(1, 2);
    expect(luminance(BLACK)).toBeCloseTo(0, 2);
  });

  it("gives the maximal 21:1 contrast for black on white", () => {
    expect(contrast(WHITE, BLACK)).toBeCloseTo(21, 1);
    expect(contrast(WHITE, WHITE)).toBeCloseTo(1, 5);
  });

  it("picks dark text on a light background and vice versa", () => {
    expect(bestForeground(WHITE)).toEqual({ l: 0.21, c: 0, h: 0 });
    expect(bestForeground(BLACK)).toEqual({ l: 0.985, c: 0, h: 0 });
  });
});
