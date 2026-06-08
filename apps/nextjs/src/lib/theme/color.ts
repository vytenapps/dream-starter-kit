/**
 * Hand-rolled OKLCH color utilities — no external color-math dependency.
 *
 * Theme tokens are stored as `oklch(L C H)` strings (matching `theme.css`). The
 * editor's color pickers work in hex, and the Simple-mode derivation works in
 * OKLCH space (perceptually uniform, so lightness/chroma math behaves). These
 * helpers convert between the two and provide the small set of OKLCH operations
 * the derivation needs (mix, set-lightness, rotate-hue, pick-foreground).
 *
 * The sRGB ↔ Oklab matrices are the standard ones (Björn Ottosson).
 */

export interface Oklch {
  /** Lightness 0–1. */
  l: number;
  /** Chroma ~0–0.4. */
  c: number;
  /** Hue 0–360 (degrees). */
  h: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Parse an `oklch(L C H)` string. Falls back to mid-grey on bad input. */
export function parseOklch(input: string): Oklch {
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i.exec(input.trim());
  if (!m) return { l: 0.5, c: 0, h: 0 };
  return {
    l: parseFloat(m[1] ?? "0"),
    c: parseFloat(m[2] ?? "0"),
    h: parseFloat(m[3] ?? "0"),
  };
}

/** Format an Oklch back to a canonical `oklch(L C H)` string. */
export function formatOklch({ l, c, h }: Oklch): string {
  const L = clamp01(l);
  if (c < 0.0005) return `oklch(${round(L, 4)} 0 0)`;
  return `oklch(${round(L, 4)} ${round(Math.max(0, c), 4)} ${round((h + 360) % 360, 2)})`;
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** Format `color` (oklch or hex) as an OKLCH string with an alpha channel. */
export function formatOklchAlpha(color: string, alpha: number): string {
  const { l, c, h } = parseOklch(toOklchString(color));
  const a = Math.max(0, Math.min(1, alpha));
  return `oklch(${round(clamp01(l), 4)} ${round(Math.max(0, c), 4)} ${round((h + 360) % 360, 2)} / ${round(a, 4)})`;
}

/** Normalize any stored color (hex or oklch) to an `oklch(...)` string. */
export function toOklchString(color: string): string {
  const t = color.trim();
  if (/^#?[0-9a-fA-F]{3,6}$/.test(t)) return formatOklch(hexToOklch(t));
  return t;
}

export function oklchToHex(color: string | Oklch): string {
  const {
    l: L,
    c: C,
    h: Hdeg,
  } = typeof color === "string" ? parseOklch(color) : color;
  const H = Hdeg * (Math.PI / 180);
  const a = C * Math.cos(H);
  const b = C * Math.sin(H);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  const lr = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const lg = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const lb = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  const toGamma = (x: number) =>
    x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  const to255 = (x: number) => Math.round(clamp01(toGamma(x)) * 255);

  const rr = to255(lr);
  const gg = to255(lg);
  const bb = to255(lb);
  const hx = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hx(rr)}${hx(gg)}${hx(bb)}`;
}

export function hexToOklch(hex: string): Oklch {
  const norm = hex.startsWith("#") ? hex.slice(1) : hex;
  const full =
    norm.length === 3
      ? norm
          .split("")
          .map((c) => c + c)
          .join("")
      : norm;
  if (full.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(full)) {
    return { l: 0.5, c: 0, h: 0 };
  }
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const toLinear = (x: number) =>
    x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  const l_ = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m_ = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s_ = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const lc = Math.cbrt(l_);
  const mc = Math.cbrt(m_);
  const sc = Math.cbrt(s_);

  const L = 0.2104542553 * lc + 0.793617785 * mc - 0.0040720468 * sc;
  const aa = 1.9779984951 * lc - 2.428592205 * mc + 0.4505937099 * sc;
  const bb = 0.0259040371 * lc + 0.7827717662 * mc - 0.808675766 * sc;

  const C = Math.sqrt(aa * aa + bb * bb);
  let H = Math.atan2(bb, aa) * (180 / Math.PI);
  if (H < 0) H += 360;
  return { l: L, c: C < 0.0005 ? 0 : C, h: H };
}

/** Convert any stored theme color (oklch or hex) to a hex string for inputs. */
export function toHex(color: string): string {
  const t = color.trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(t)) return t.startsWith("#") ? t : `#${t}`;
  if (/^#?[0-9a-fA-F]{3}$/.test(t)) {
    const n = t.replace("#", "");
    return `#${n
      .split("")
      .map((c) => c + c)
      .join("")}`;
  }
  return oklchToHex(t);
}

/** Linear interpolation between two OKLCH colors (hue takes the short path). */
export function mix(a: Oklch, b: Oklch, t: number): Oklch {
  let dh = b.h - a.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return {
    l: a.l + (b.l - a.l) * t,
    c: a.c + (b.c - a.c) * t,
    h: (a.h + dh * t + 360) % 360,
  };
}

/** Return a copy with a new lightness (chroma/hue preserved). */
export function withL(color: Oklch, l: number): Oklch {
  return { ...color, l: clamp01(l) };
}

/** Rotate the hue by `deg` degrees. */
export function rotateHue(color: Oklch, deg: number): Oklch {
  return { ...color, h: (color.h + deg + 360) % 360 };
}

/** WCAG relative luminance (0–1) of an OKLCH color. */
export function luminance(color: Oklch): number {
  const hex = oklchToHex(color);
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (x: number) =>
    x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio (1–21) between two OKLCH colors. */
export function contrast(a: Oklch, b: Oklch): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Pick whichever of `light`/`dark` reads best on `bg` (higher contrast).
 * Used for *-foreground tokens so text stays legible on derived surfaces.
 */
export function bestForeground(
  bg: Oklch,
  light: Oklch = { l: 0.985, c: 0, h: 0 },
  dark: Oklch = { l: 0.21, c: 0, h: 0 },
): Oklch {
  return contrast(bg, light) >= contrast(bg, dark) ? light : dark;
}
