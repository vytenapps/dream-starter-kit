/**
 * Pure image-format specs + presets — NO server-only / `ai` / `sharp` imports,
 * so this is safe to import from Payload collection configs (which the Payload
 * CLI loads) and anywhere else. The actual renderer lives in the server-only
 * `image-generation.ts`, which imports these types/presets.
 */

/** One image variant to render (e.g. a 16:9 hero or a 1:1 card thumbnail). */
export interface ImageFormatSpec {
  /** Stable key — used in the generated filename and skip logic. */
  key: string;
  /** The collection upload field this format fills. */
  field: string;
  /** Aspect ratio passed to the model, e.g. `16:9`. */
  aspectRatio: `${number}:${number}`;
  /** Final pixel dimensions (sharp resizes/crops to these). */
  width: number;
  height: number;
  /** Per-format composition guidance appended to the prompt. */
  composition: string;
}

/** A rendered, sharp-normalized image ready to become a Media doc. */
export interface GeneratedImage {
  format: ImageFormatSpec;
  data: Buffer;
  mimetype: "image/webp";
  extension: "webp";
}

// --- Named preset format sets -------------------------------------------------
// Collections pick a preset instead of re-declaring dimensions. Each format's
// `field` is the upload field name the generated-images helper/hook expects.

/** A landscape hero for the article/detail header. */
export const HERO_FORMAT: ImageFormatSpec = {
  key: "hero",
  field: "imageHero",
  aspectRatio: "16:9",
  width: 1600,
  height: 900,
  composition:
    "Wide landscape hero banner; the focal subject sits left-of-center with " +
    "open space to the right for an overlaid headline.",
};

/** A 1200×630 Open Graph / social-share card. */
export const OG_FORMAT: ImageFormatSpec = {
  key: "og",
  field: "imageOg",
  aspectRatio: "40:21",
  width: 1200,
  height: 630,
  composition:
    "Centered, high-contrast social-share card; subject fills the frame and " +
    "reads clearly at small sizes.",
};

/** A 1:1 square thumbnail for catalog/feed cards. */
export const SQUARE_FORMAT: ImageFormatSpec = {
  key: "square",
  field: "imageSquare",
  aspectRatio: "1:1",
  width: 1080,
  height: 1080,
  composition:
    "Tightly cropped square thumbnail; single bold subject centered, minimal " +
    "background, instantly legible in a grid.",
};

/** Featured (hero + OG) — the default for editorial/detail content. */
export const FEATURED_FORMATS = [HERO_FORMAT, OG_FORMAT] as const;

/** Card (hero + OG + square) — for content rendered in a catalog/feed grid. */
export const CARD_FORMATS = [HERO_FORMAT, OG_FORMAT, SQUARE_FORMAT] as const;

/** Square-only — for the Media library's default standalone generation. */
export const SQUARE_ONLY_FORMATS = [SQUARE_FORMAT] as const;

/** Lookup a single format spec by its `key` (used by the generate_media tool). */
export const IMAGE_FORMAT_PRESETS: Record<string, ImageFormatSpec> = {
  hero: HERO_FORMAT,
  og: OG_FORMAT,
  square: SQUARE_FORMAT,
};

// --- Post-generation audit (pure types) ---------------------------------------
// The audit runtime (vision model via the AI Gateway) lives in the server-only
// `image-audit.ts`; these types are server-free so both the settings resolver
// (payload/hooks/generate-images.ts) and the renderer can share them.

/** What to do with an image that never passes the audit within max attempts. */
export type AuditFailureAction = "publish" | "skip";

/** Resolved post-generation audit settings (from the global, with defaults). */
export interface ResolvedAuditSettings {
  /** When true, every generated image is reviewed and bad ones regenerated. */
  enabled: boolean;
  /** Total generate→audit attempts before giving up (>= 1). */
  maxAttempts: number;
  /** Gateway vision-model slug for the audit, or undefined for the code default. */
  model?: string;
  /** Extra, workspace-specific acceptance criteria for the judge. */
  instructions?: string;
  /** After the final failed attempt: keep the last image, or attach nothing. */
  failureAction: AuditFailureAction;
}
