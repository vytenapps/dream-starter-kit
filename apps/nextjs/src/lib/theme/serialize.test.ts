import { describe, expect, it } from "vitest";

import { COLOR_TOKENS, DEFAULT_RADIUS } from "./defaults";
import { themeToCss } from "./serialize";

function token(field: string) {
  const t = COLOR_TOKENS.find((x) => x.field === field);
  if (!t) throw new Error(`unknown color token: ${field}`);
  return t;
}
const primary = token("primary");
const background = token("background");

describe("themeToCss", () => {
  it("falls back to the built-in defaults when settings is null", () => {
    const css = themeToCss(null);

    // Doubled selector so the override outranks theme.css's plain `:root`.
    expect(css).toContain(":root:root {");
    // Dark block targets the front end's `.dark` only — the admin uses a fixed
    // palette (admin-theme.ts), so this serializer no longer emits the admin's
    // `[data-theme="dark"]` selector.
    expect(css).toContain(":root:root.dark {");
    expect(css).not.toContain('[data-theme="dark"]');
    // Default token + dimension values come straight from the TS mirror.
    expect(css).toContain(`--primary: ${primary.light};`);
    expect(css).toContain(`--radius: ${DEFAULT_RADIUS};`);
  });

  it("emits dark defaults in the dark block", () => {
    const css = themeToCss(null);
    const darkBlock = css.slice(css.indexOf(":root:root.dark {"));
    expect(darkBlock).toContain(`--primary: ${primary.dark};`);
  });

  it("applies custom color and radius overrides", () => {
    const css = themeToCss({
      colorsLight: { primary: "oklch(0.7 0.2 30)" },
      radius: "1.25rem",
    });

    expect(css).toContain("--primary: oklch(0.7 0.2 30);");
    expect(css).toContain("--radius: 1.25rem;");
    // Untouched tokens still fall back to their defaults.
    expect(css).toContain(`--background: ${background.light};`);
  });

  it("sanitizes values that could break out of the <style> block", () => {
    const css = themeToCss({ radius: "1rem; } body { color: red" });
    // The `;{}` that could close the declaration / open a new rule are stripped.
    expect(css).not.toContain("} body {");
    expect(css).toContain("--radius: 1rem  body  color: red;");
  });
});
