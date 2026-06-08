/**
 * Simple-mode derivation: turn THREE anchor colors (background, foreground,
 * primary) into a full 31-token palette, and auto-generate a matching dark
 * palette. This is the engine behind the editor's "Simple" mode — the user
 * picks three colors and every Advanced token is computed from them.
 *
 * All math is in OKLCH (see ./color). Surfaces are interpolations between
 * background and foreground; *-foreground tokens pick the higher-contrast of
 * near-white/near-black; charts fan out from the primary hue. Output values are
 * `oklch(...)` strings keyed by the Payload field names (see ./defaults
 * COLOR_TOKENS).
 */
import type { Oklch } from "./color";
import type { ColorSet } from "./defaults";
import {
  bestForeground,
  formatOklch,
  mix,
  parseOklch,
  rotateHue,
  withL,
} from "./color";

/** Fixed destructive red (matches theme.css light/dark). */
const DESTRUCTIVE_LIGHT: Oklch = { l: 0.6368, c: 0.2078, h: 25.33 };
const DESTRUCTIVE_DARK: Oklch = { l: 0.3958, c: 0.1331, h: 25.72 };
const NEAR_WHITE: Oklch = { l: 0.985, c: 0, h: 0 };

/**
 * Derive every theme token for ONE mode from three anchors.
 * @param bg  background (oklch string)
 * @param fg  foreground (oklch string)
 * @param primary primary/brand (oklch string)
 */
export function derivePalette(
  bg: string,
  fg: string,
  primary: string,
): Record<string, string> {
  const B = parseOklch(bg);
  const F = parseOklch(fg);
  const P = parseOklch(primary);
  const isDark = B.l < 0.5;

  const fmt = formatOklch;
  const surface = (t: number) => fmt(mix(B, F, t));

  const primaryFg = bestForeground(P, NEAR_WHITE, withL(F, 0.18));
  const destructive = isDark ? DESTRUCTIVE_DARK : DESTRUCTIVE_LIGHT;

  const border = surface(isDark ? 0.18 : 0.12);
  const muted = surface(isDark ? 0.1 : 0.08);
  const accent = surface(isDark ? 0.12 : 0.1);

  return {
    background: fmt(B),
    foreground: fmt(F),
    card: isDark ? fmt(withL(B, B.l + 0.03)) : fmt(B),
    cardForeground: fmt(F),
    popover: isDark ? fmt(withL(B, B.l + 0.03)) : fmt(B),
    popoverForeground: fmt(F),

    primary: fmt(P),
    primaryForeground: fmt(primaryFg),
    secondary: muted,
    secondaryForeground: fmt(F),
    destructive: fmt(destructive),
    destructiveForeground: fmt(NEAR_WHITE),

    muted,
    mutedForeground: fmt(mix(F, B, 0.4)),
    accent,
    accentForeground: fmt(P),
    border,
    input: isDark ? surface(0.18) : surface(0.1),
    ring: fmt(P),

    // Chart palette fans out from the primary hue.
    chart1: fmt(P),
    chart2: fmt(withL(rotateHue(P, 40), Math.min(0.85, P.l + 0.08))),
    chart3: fmt(withL(rotateHue(P, 80), Math.min(0.9, P.l + 0.16))),
    chart4: fmt(withL(rotateHue(P, -40), Math.max(0.3, P.l - 0.08))),
    chart5: fmt(withL(rotateHue(P, -80), Math.max(0.25, P.l - 0.16))),

    // Sidebar mirrors the main surface + brand.
    sidebar: surface(isDark ? 0.04 : 0.02),
    sidebarForeground: fmt(F),
    sidebarPrimary: fmt(P),
    sidebarPrimaryForeground: fmt(primaryFg),
    sidebarAccent: accent,
    sidebarAccentForeground: fmt(P),
    sidebarBorder: border,
    sidebarRing: fmt(P),
  };
}

/**
 * Mirror the sidebar tokens onto the main surface + brand tokens (the editor's
 * "sync sidebar" toggle). Mirrors vyten's `deriveSidebarFromBase`.
 */
export function deriveSidebarFromBase(colors: ColorSet): ColorSet {
  return {
    sidebar: colors.background,
    sidebarForeground: colors.foreground,
    sidebarPrimary: colors.primary,
    sidebarPrimaryForeground: colors.primaryForeground,
    sidebarAccent: colors.accent,
    sidebarAccentForeground: colors.accentForeground,
    sidebarBorder: colors.border,
    sidebarRing: colors.ring,
  };
}

/**
 * Derive BOTH light and dark palettes from three light-mode anchors. The dark
 * palette flips surface lightness (background → dark, foreground → light) while
 * keeping the primary hue, then derives from those.
 */
export function deriveBoth(
  bg: string,
  fg: string,
  primary: string,
): { light: Record<string, string>; dark: Record<string, string> } {
  const B = parseOklch(bg);
  const F = parseOklch(fg);
  const darkBg = formatOklch(withL({ ...B, c: Math.min(B.c, 0.02) }, 0.18));
  const darkFg = formatOklch(withL({ ...F, c: Math.min(F.c, 0.02) }, 0.97));
  return {
    light: derivePalette(bg, fg, primary),
    dark: derivePalette(darkBg, darkFg, primary),
  };
}
