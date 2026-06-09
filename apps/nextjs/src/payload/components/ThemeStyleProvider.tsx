import type { ReactNode } from "react";
import { Inter } from "next/font/google";

import { ADMIN_THEME_CSS } from "~/lib/theme/admin-theme";

/**
 * The admin's pinned sans font. Payload's auto-generated `(payload)/layout.tsx`
 * doesn't load the front end's `next/font` families, so the admin had no
 * `--font-*` value and fell back to the browser serif. We self-host Inter here.
 */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

/**
 * Font tokens injected at `:root` with Inter's RESOLVED family
 * (`inter.style.fontFamily` → e.g. `"Inter", "Inter Fallback"`). We deliberately
 * avoid a `var(--font-inter)` indirection: a custom property's `var()` is
 * substituted at the element where the property is declared (`:root`), where
 * `--font-inter` isn't defined — so the indirection would inherit the fallback,
 * not Inter. Declaring the literal family at `:root` themes the whole admin
 * (chrome reads `--font-body: var(--font-sans)` via custom.css).
 */
const ADMIN_FONT_CSS = `:root:root {
  --font-sans: ${inter.style.fontFamily}, system-ui, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}`;

/**
 * Payload admin provider (registered as `admin.components.providers`). Wraps
 * every admin route and injects the admin's FIXED theme as a `<style>`. Unlike
 * the front end — themed at runtime by the editable `theme-settings` global —
 * the admin is pinned to a hardcoded palette (`~/lib/theme/admin-theme.ts`), so
 * the admin chrome stays consistent regardless of the site-wide global.
 *
 * These tokens (`--background`/`--foreground`/…) are what `custom.css` maps onto
 * Payload's own chrome variables, so the admin follows the fixed theme. The
 * `inter.variable` wrapper (a `display: contents` box, so no layout impact)
 * ensures `next/font` emits Inter's `@font-face` for this route.
 */
export function ThemeStyleProvider({ children }: { children: ReactNode }) {
  return (
    <>
      <style
        id="theme-admin"
        dangerouslySetInnerHTML={{
          __html: `${ADMIN_THEME_CSS}\n${ADMIN_FONT_CSS}`,
        }}
      />
      <div className={inter.variable} style={{ display: "contents" }}>
        {children}
      </div>
    </>
  );
}
