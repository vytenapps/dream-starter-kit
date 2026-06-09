import type { Field } from "payload";

/**
 * Shared field helpers for the Launch UI page-layout blocks. Keeping these in
 * one place means every block exposes the same button/icon controls, and the
 * RenderBlocks mapping can resolve them consistently.
 */

/** Button style options, mirroring the Launch UI button `variant`s we expose. */
export const BUTTON_VARIANTS = [
  { label: "Primary", value: "default" },
  { label: "Glow (glass)", value: "glow" },
  { label: "Outline", value: "outline" },
  { label: "Secondary", value: "secondary" },
] as const;

/** A repeatable call-to-action button (text + href + style). */
export const buttonsField = (name = "buttons", label = "Buttons"): Field => ({
  name,
  type: "array",
  label,
  fields: [
    { name: "text", type: "text", required: true },
    { name: "href", type: "text", required: true },
    {
      name: "variant",
      type: "select",
      defaultValue: "default",
      options: [...BUTTON_VARIANTS],
    },
  ],
});

/**
 * Curated lucide icon names offered for feature items. The RenderBlocks mapping
 * (`~/components/render-blocks`) resolves the stored name to the icon component;
 * keep the two lists in sync when adding an option.
 */
export const ICON_OPTIONS = [
  "Rocket",
  "Zap",
  "ShieldCheck",
  "Sparkles",
  "Star",
  "Heart",
  "Globe",
  "Code",
  "Layers",
  "Smartphone",
  "Palette",
  "Lock",
  "Check",
  "Cloud",
  "Bell",
  "Settings",
  "Users",
  "ChartBar",
  "Search",
  "Mail",
] as const;

export const iconField = (name = "icon"): Field => ({
  name,
  type: "select",
  options: ICON_OPTIONS.map((value) => ({ label: value, value })),
  admin: { description: "Optional lucide icon." },
});
