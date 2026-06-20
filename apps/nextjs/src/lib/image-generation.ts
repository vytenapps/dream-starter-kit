import "server-only";

import { experimental_generateImage as generateImage, gateway } from "ai";
import sharp from "sharp";

import { DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_SYSTEM_PROMPT } from "@acme/config";

/**
 * Core CMS image generation (server-only — imports `ai` + `sharp`, both Node).
 * NEVER import this into a client/Expo bundle; it lives behind `import
 * "server-only"` and is reached only from Payload hooks (server) and the MCP
 * `generate_media` tool (injected). See docs/ARCHITECTURE.md → image generation.
 *
 * Given a text prompt and a caller-supplied set of formats, renders each format
 * via the Vercel AI Gateway (golden rule #5: the model slug comes from
 * `@acme/config`, overridable by the `image-generation-settings` global / env),
 * normalizes it with sharp (cover-fit → webp), and returns the raw buffers. The
 * caller decides what to do with them (create Media docs + attach ids).
 *
 * Formats are generated IN PARALLEL; the function itself does no Payload/storage
 * work, so it's pure and unit-testable.
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

export interface GenerateImagesArgs {
  /** The subject prompt (what to draw) — typically the doc's `imagePrompt`. */
  prompt: string;
  /** Gateway image-model slug. Defaults to DEFAULT_IMAGE_MODEL (@acme/config). */
  model?: string;
  /** Art-direction prefix. Defaults to DEFAULT_IMAGE_SYSTEM_PROMPT. */
  systemPrompt?: string;
  /** Which formats to render. */
  formats: readonly ImageFormatSpec[];
}

/** WebP quality for normalized outputs — visually lossless, small files. */
const WEBP_QUALITY = 82;

/** Trim a value; return undefined when blank (so `??` falls through to defaults). */
function nonEmpty(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Compose the full prompt sent to the model: art direction, then the subject,
 * then this format's composition note. Kept deterministic for unit tests.
 */
export function composeImagePrompt(
  systemPrompt: string,
  subject: string,
  composition: string,
): string {
  return [
    systemPrompt.trim(),
    `Subject: ${subject.trim()}`,
    composition.trim() ? `Composition: ${composition.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Render every requested format in parallel. Rejects if ANY format fails — the
 * per-format isolation (so one failure never discards the others) lives in the
 * hook/tool callers, which call this per-format. Callers that want all-or-
 * nothing can pass the whole set.
 */
export async function generateImages(
  args: GenerateImagesArgs,
): Promise<GeneratedImage[]> {
  const model = nonEmpty(args.model) ?? DEFAULT_IMAGE_MODEL;
  const systemPrompt = nonEmpty(args.systemPrompt) ?? DEFAULT_IMAGE_SYSTEM_PROMPT;
  const subject = args.prompt;

  return Promise.all(
    args.formats.map((format) =>
      generateOneImage({ model, systemPrompt, subject, format }),
    ),
  );
}

/** Render + normalize a single format. Exported for per-format isolation. */
export async function generateOneImage(args: {
  model: string;
  systemPrompt: string;
  subject: string;
  format: ImageFormatSpec;
}): Promise<GeneratedImage> {
  const { format } = args;
  const { image } = await generateImage({
    model: gateway.imageModel(args.model),
    prompt: composeImagePrompt(args.systemPrompt, args.subject, format.composition),
    aspectRatio: format.aspectRatio,
  });

  const data = await sharp(Buffer.from(image.uint8Array))
    .resize(format.width, format.height, { fit: "cover" })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  return { format, data, mimetype: "image/webp", extension: "webp" };
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
