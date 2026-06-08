import { getThemeSettings } from "~/lib/payload";
import { themeToCss } from "~/lib/theme/serialize";

/**
 * Server component that injects the site-wide shadcn theme as a `<style>` tag.
 * Reads the `theme-settings` CMS global and serializes it to CSS-variable
 * overrides on `:root` / `.dark` / `[data-theme="dark"]`, layered after the
 * static defaults in `theme.css` so it wins by cascade. Rendered server-side, so
 * there's no flash. Used by both the front-end root layout and the Payload admin.
 */
export async function ThemeStyle() {
  const settings = await getThemeSettings();
  return (
    <style
      id="theme-overrides"
      dangerouslySetInnerHTML={{ __html: themeToCss(settings) }}
    />
  );
}
