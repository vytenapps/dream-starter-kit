import type { ReactNode } from "react";

import { getThemeSettings } from "~/lib/payload";
import { themeToCss } from "~/lib/theme/serialize";

/**
 * Payload admin provider (registered as `admin.components.providers`). Wraps
 * every admin route and injects the site-wide shadcn theme — the same
 * `theme-settings` global that themes the front end — as a `<style>`. This sets
 * the `--background`/`--foreground`/… token values that `custom.css` maps onto
 * Payload's own chrome variables, so the admin follows the site theme.
 *
 * Server component (async): reads the global via the Local API. Degrades to the
 * built-in defaults if the CMS isn't reachable.
 */
export async function ThemeStyleProvider({
  children,
}: {
  children: ReactNode;
}) {
  const settings = await getThemeSettings();
  return (
    <>
      <style
        id="theme-overrides"
        dangerouslySetInnerHTML={{ __html: themeToCss(settings) }}
      />
      {children}
    </>
  );
}
