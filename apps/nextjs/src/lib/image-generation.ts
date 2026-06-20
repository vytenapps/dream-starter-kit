import "server-only";

import { experimental_generateImage as generateImage, gateway } from "ai";
import sharp from "sharp";

import { DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_SYSTEM_PROMPT } from "@acme/config";

import type { GeneratedImage, ImageFormatSpec } from "./image-formats";

/**
 * Core CMS image generation (server-only — imports `ai` + `sharp`, both Node).
 * NEVER import this into a client/Expo bundle; it lives behind `import
 * "server-only"` and is reached only from Payload hooks (server) and the MCP
 * `generate_media` tool (injected). See docs/ARCHITECTURE.md → image generation.
 *
 * Given a text prompt and a caller-supplied set of formats (see image-formats.ts
 * — kept in a server-free module so collection configs can import the presets),
 * renders each format via the Vercel AI Gateway (golden rule #5: the model slug
 * comes from `@acme/config`, overridable by the `image-generation-settings`
 * global / env), normalizes it with sharp (cover-fit → webp), and returns the
 * raw buffers. The caller decides what to do with them (create Media docs +
 * attach ids).
 *
 * Formats are generated IN PARALLEL; the function itself does no Payload/storage
 * work, so it's pure and unit-testable.
 */

export type { GeneratedImage, ImageFormatSpec } from "./image-formats";

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

// Preset format sets + ImageFormatSpec live in ./image-formats (server-free) so
// collection configs can import them without pulling in `ai`/`sharp`. Re-export
// here for convenience (server callers can import everything from one module).
export * from "./image-formats";
