import { describe, expect, it } from "vitest";

import {
  contrast,
  hexToOklch,
  oklchToHex,
  parseOklch as parseOklchRaw,
} from "./color";
import { COLOR_TOKENS } from "./defaults";
import { deriveBoth, derivePalette } from "./derive";

// Palettes are typed as Record<string,string>; under noUncheckedIndexedAccess
// member access widens to `| undefined`. Tokens always exist here, so coalesce.
const parseOklch = (v: string | undefined) => parseOklchRaw(v ?? "");

describe("color conversions", () => {
  it("round-trips hex → oklch → hex within tolerance", () => {
    for (const hex of ["#ffffff", "#000000", "#3b82f6", "#e11d48", "#16a34a"]) {
      const back = oklchToHex(hexToOklch(hex));
      // allow ±2/255 per channel for float/gamut rounding
      for (let i = 1; i < 7; i += 2) {
        const a = parseInt(hex.slice(i, i + 2), 16);
        const b = parseInt(back.slice(i, i + 2), 16);
        expect(Math.abs(a - b)).toBeLessThanOrEqual(2);
      }
    }
  });

  it("parses oklch strings", () => {
    expect(parseOklch("oklch(0.533 0.236 264.19)")).toEqual({
      l: 0.533,
      c: 0.236,
      h: 264.19,
    });
  });
});

const LIGHT = {
  bg: "oklch(1 0 0)",
  fg: "oklch(0.2 0 0)",
  primary: "oklch(0.533 0.236 264.19)",
};

describe("derivePalette", () => {
  const palette = derivePalette(LIGHT.bg, LIGHT.fg, LIGHT.primary);

  it("produces every theme token", () => {
    for (const token of COLOR_TOKENS) {
      expect(palette[token.field], token.field).toBeTruthy();
      expect(palette[token.field]).toMatch(/^oklch\(/);
    }
    expect(Object.keys(palette).length).toBe(COLOR_TOKENS.length);
  });

  it("keeps the anchors verbatim", () => {
    expect(palette.background).toBe("oklch(1 0 0)");
    expect(palette.primary).toBe(LIGHT.primary);
    expect(palette.ring).toBe(LIGHT.primary);
  });

  it("primary-foreground is legible on primary (AA)", () => {
    const ratio = contrast(
      parseOklch(palette.primary),
      parseOklch(palette.primaryForeground),
    );
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("body text is legible on the background (AA)", () => {
    const ratio = contrast(
      parseOklch(palette.background),
      parseOklch(palette.foreground),
    );
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

describe("deriveBoth", () => {
  const { light, dark } = deriveBoth(LIGHT.bg, LIGHT.fg, LIGHT.primary);

  it("generates a dark palette with a dark background and light text", () => {
    expect(parseOklch(dark.background).l).toBeLessThan(0.3);
    expect(parseOklch(dark.foreground).l).toBeGreaterThan(0.9);
    // light stays light
    expect(parseOklch(light.background).l).toBeGreaterThan(0.9);
  });

  it("keeps the brand primary across modes", () => {
    expect(light.primary).toBe(LIGHT.primary);
    expect(dark.primary).toBe(LIGHT.primary);
  });

  it("dark text is legible on dark background (AA)", () => {
    const ratio = contrast(
      parseOklch(dark.background),
      parseOklch(dark.foreground),
    );
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
