/**
 * Turns a theme (the `theme-settings` global, or the built-in defaults) into the
 * CSS injected into the front end by `<ThemeStyle />`. The output overrides the
 * static defaults from `theme.css` and targets the front end's `.dark` selector
 * (see packages/ui/src/theme.tsx). The Payload admin is NOT themed from this
 * global — it uses a fixed palette (`~/lib/theme/admin-theme.ts`).
 *
 * Selectors are doubled (`:root:root`) to raise specificity above theme.css's
 * plain `:root` — so the override wins no matter the `<head>` source order
 * (Next injects the stylesheet link unpredictably relative to this inline tag).
 */
import type { ShadowSettings, ThemeSettingsInput } from "./defaults";
import { formatOklchAlpha } from "./color";
import {
  COLOR_TOKENS,
  DEFAULT_LETTER_SPACING,
  DEFAULT_RADIUS,
  DEFAULT_SHADOW,
  DEFAULT_SPACING,
  resolveFontMono,
  resolveFontSans,
  resolveFontSerif,
} from "./defaults";

/** Strip anything that could break out of a CSS declaration. Values are
 *  staff-authored, but we never trust input that reaches an injected <style>. */
function sanitize(value: string): string {
  return value.replace(/[{}<>;]/g, "").trim();
}

/**
 * Compose the shadcn `--shadow-*` scale from the shadow primitives. Sizes ramp
 * opacity (and blur) the way tweakcn/shadcn-studio output does, so the eight
 * size tokens stay consistent with one set of controls.
 */
function shadowVars(
  shadow: ShadowSettings | null | undefined,
): { cssVar: string; value: string }[] {
  const s = {
    color: shadow?.color ?? DEFAULT_SHADOW.color,
    opacity: shadow?.opacity ?? DEFAULT_SHADOW.opacity,
    blurRadius: shadow?.blurRadius ?? DEFAULT_SHADOW.blurRadius,
    spread: shadow?.spread ?? DEFAULT_SHADOW.spread,
    offsetX: shadow?.offsetX ?? DEFAULT_SHADOW.offsetX,
    offsetY: shadow?.offsetY ?? DEFAULT_SHADOW.offsetY,
  };
  const base = `${s.offsetX}px ${s.offsetY}px`;
  const make = (opacityMult: number, extraBlur = 0) =>
    `${base} ${s.blurRadius + extraBlur}px ${s.spread}px ${formatOklchAlpha(s.color, s.opacity * opacityMult)}`;
  return [
    { cssVar: "shadow-2xs", value: make(0.5) },
    { cssVar: "shadow-xs", value: make(0.5) },
    { cssVar: "shadow-sm", value: make(1) },
    { cssVar: "shadow", value: make(1) },
    { cssVar: "shadow-md", value: make(1, 2) },
    { cssVar: "shadow-lg", value: make(1, 4) },
    { cssVar: "shadow-xl", value: make(1, 8) },
    { cssVar: "shadow-2xl", value: make(2.5, 8) },
  ];
}

function declarations(
  pairs: { cssVar: string; value: string }[],
  indent = "  ",
): string {
  return pairs
    .map(({ cssVar, value }) => `${indent}--${cssVar}: ${sanitize(value)};`)
    .join("\n");
}

export function themeToCss(settings: ThemeSettingsInput | null): string {
  const light = settings?.colorsLight ?? {};
  const dark = settings?.colorsDark ?? {};

  const radius = settings?.radius ?? DEFAULT_RADIUS;
  const spacing = settings?.spacing ?? DEFAULT_SPACING;
  const tracking = settings?.letterSpacing ?? DEFAULT_LETTER_SPACING;
  const fontSans = resolveFontSans(settings?.fontSans);
  const fontMono = resolveFontMono(settings?.fontMono);
  const fontSerif = resolveFontSerif(settings?.fontSerif);

  const lightColors = COLOR_TOKENS.map((t) => ({
    cssVar: t.cssVar,
    value: light[t.field] ?? t.light,
  }));
  const darkColors = COLOR_TOKENS.map((t) => ({
    cssVar: t.cssVar,
    value: dark[t.field] ?? t.dark,
  }));

  const rootExtras = [
    { cssVar: "radius", value: radius },
    { cssVar: "spacing", value: spacing },
    { cssVar: "tracking-normal", value: tracking },
    { cssVar: "font-sans", value: fontSans },
    { cssVar: "font-mono", value: fontMono },
    { cssVar: "font-serif", value: fontSerif },
    ...shadowVars(settings?.shadow),
  ];

  return [
    ":root:root {",
    declarations([...lightColors, ...rootExtras]),
    "}",
    ":root:root.dark {",
    declarations(darkColors),
    "}",
  ].join("\n");
}
