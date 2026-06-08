import type { Field, GlobalConfig } from "payload";

import {
  COLOR_TOKENS,
  DEFAULT_FONT_MONO,
  DEFAULT_FONT_SANS,
  DEFAULT_FONT_SERIF,
  DEFAULT_LETTER_SPACING,
  DEFAULT_RADIUS,
  DEFAULT_SHADOW,
  DEFAULT_SPACING,
  FONT_MONO_OPTIONS,
  FONT_SANS_OPTIONS,
  FONT_SERIF_OPTIONS,
} from "../../lib/theme/defaults";
import { anyone, isAdmin } from "../access";

const colorFields = (mode: "light" | "dark"): Field[] =>
  COLOR_TOKENS.map((token) => ({
    name: token.field,
    type: "text",
    label: token.label,
    defaultValue: token[mode],
    admin: {
      description: `--${token.cssVar} · any CSS color (oklch recommended)`,
      width: "50%",
    },
  }));

const selectFrom = (options: { value: string; label: string }[]) =>
  options.map((o) => ({ label: o.label, value: o.value }));

/**
 * Site-wide shadcn theme — the single source of runtime truth for branding,
 * color, typography, and styles across the whole surface: the web front end AND
 * the Payload admin panel. Read by `<ThemeStyle />` (serialized to a `<style>`
 * that overrides the `theme.css` defaults) and by `getBranding()`.
 *
 * Edited primarily via the rich custom view at `/admin/theme` (Simple +
 * Advanced modes); this native form is the underlying data store. Values default
 * to the built-in theme so day one is a no-op. See `apps/nextjs/src/lib/theme`
 * and CLAUDE.md → Theming.
 */
export const ThemeSettings: GlobalConfig = {
  slug: "theme-settings",
  label: "Theme",
  admin: {
    group: "Admin",
    // Hidden from the admin nav: this global is the data store, edited only via
    // the polished custom view at /admin/theme (which reads it via the Local API
    // and saves via the REST endpoint — neither depends on nav visibility).
    hidden: true,
    description:
      "Branding, colors, typography and styles for the entire app and this admin panel. Edited via /admin/theme.",
  },
  // Public read: the front end needs the theme to render for anonymous visitors.
  // Update is staff-only.
  access: { read: anyone, update: isAdmin },
  fields: [
    // Which editor mode was last used in the /admin/theme view.
    {
      name: "editorMode",
      type: "select",
      defaultValue: "simple",
      options: [
        { label: "Simple", value: "simple" },
        { label: "Advanced", value: "advanced" },
      ],
      admin: { hidden: true },
    },
    {
      type: "tabs",
      tabs: [
        {
          label: "Branding",
          fields: [
            {
              name: "appName",
              type: "text",
              maxLength: 100,
              admin: {
                description:
                  "Display name shown in the app shell and tab title.",
              },
            },
            {
              name: "appIcon",
              type: "upload",
              relationTo: "media",
              admin: {
                description:
                  "Square icon — used as the favicon (512×512 ideal).",
              },
            },
            {
              name: "logoLight",
              type: "upload",
              relationTo: "media",
              admin: { description: "Logo shown on light backgrounds." },
            },
            {
              name: "logoDark",
              type: "upload",
              relationTo: "media",
              admin: { description: "Logo shown on dark backgrounds." },
            },
          ],
        },
        {
          label: "Light",
          fields: [
            {
              name: "colorsLight",
              type: "group",
              label: false,
              fields: colorFields("light"),
            },
          ],
        },
        {
          label: "Dark",
          fields: [
            {
              name: "colorsDark",
              type: "group",
              label: false,
              fields: colorFields("dark"),
            },
          ],
        },
        {
          label: "Typography",
          fields: [
            {
              name: "fontSans",
              type: "select",
              defaultValue: DEFAULT_FONT_SANS,
              options: selectFrom(FONT_SANS_OPTIONS),
              admin: { description: "Body / UI font (--font-sans)" },
            },
            {
              name: "fontSerif",
              type: "select",
              defaultValue: DEFAULT_FONT_SERIF,
              options: selectFrom(FONT_SERIF_OPTIONS),
              admin: { description: "Serif font (--font-serif)" },
            },
            {
              name: "fontMono",
              type: "select",
              defaultValue: DEFAULT_FONT_MONO,
              options: selectFrom(FONT_MONO_OPTIONS),
              admin: { description: "Monospace font (--font-mono)" },
            },
            {
              name: "letterSpacing",
              type: "text",
              defaultValue: DEFAULT_LETTER_SPACING,
              admin: {
                description:
                  "Base letter spacing, e.g. 0rem (--tracking-normal)",
              },
            },
          ],
        },
        {
          label: "Other",
          fields: [
            {
              name: "radius",
              type: "text",
              defaultValue: DEFAULT_RADIUS,
              admin: {
                description: "Base border radius, e.g. 0.75rem (--radius)",
              },
            },
            {
              name: "spacing",
              type: "text",
              defaultValue: DEFAULT_SPACING,
              admin: {
                description: "Base spacing unit, e.g. 0.25rem (--spacing)",
              },
            },
            {
              name: "shadow",
              type: "group",
              label: "Shadow",
              admin: { description: "Drives the --shadow-* scale." },
              fields: [
                {
                  type: "row",
                  fields: [
                    {
                      name: "color",
                      type: "text",
                      defaultValue: DEFAULT_SHADOW.color,
                      admin: { width: "50%" },
                    },
                    {
                      name: "opacity",
                      type: "number",
                      defaultValue: DEFAULT_SHADOW.opacity,
                      admin: { width: "50%" },
                    },
                  ],
                },
                {
                  type: "row",
                  fields: [
                    {
                      name: "blurRadius",
                      type: "number",
                      defaultValue: DEFAULT_SHADOW.blurRadius,
                      admin: { width: "25%" },
                    },
                    {
                      name: "spread",
                      type: "number",
                      defaultValue: DEFAULT_SHADOW.spread,
                      admin: { width: "25%" },
                    },
                    {
                      name: "offsetX",
                      type: "number",
                      defaultValue: DEFAULT_SHADOW.offsetX,
                      admin: { width: "25%" },
                    },
                    {
                      name: "offsetY",
                      type: "number",
                      defaultValue: DEFAULT_SHADOW.offsetY,
                      admin: { width: "25%" },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
