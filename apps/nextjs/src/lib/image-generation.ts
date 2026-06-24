import "server-only";

import { gateway, experimental_generateImage as generateImage } from "ai";
import sharp from "sharp";

import { DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_SYSTEM_PROMPT } from "@acme/config";

import type {
  GeneratedImage,
  ImageFormatSpec,
  ResolvedAuditSettings,
} from "./image-formats";
import { auditGeneratedImage } from "./image-audit";

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
  const systemPrompt =
    nonEmpty(args.systemPrompt) ?? DEFAULT_IMAGE_SYSTEM_PROMPT;
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
    prompt: composeImagePrompt(
      args.systemPrompt,
      args.subject,
      format.composition,
    ),
    aspectRatio: format.aspectRatio,
  });

  const data = await sharp(Buffer.from(image.uint8Array))
    .resize(format.width, format.height, { fit: "cover" })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  return { format, data, mimetype: "image/webp", extension: "webp" };
}

/** Outcome of a single format's generate→audit loop. Never throws to callers. */
export interface AuditedImageOutcome {
  format: ImageFormatSpec;
  /**
   * The image to attach, or null to attach nothing (generation failed every
   * attempt, or the audit failed and the failure action is "skip").
   */
  image: GeneratedImage | null;
  /** Whether the returned image passed the audit (true when audit is off). */
  passed: boolean;
  /** How many generate→audit attempts ran (1 when audit is off). */
  attempts: number;
  /** Last verdict/error reason — for logging. */
  reason?: string;
}

export interface GenerateAuditedImageArgs {
  model: string;
  systemPrompt: string;
  /** The subject prompt (what to draw). */
  subject: string;
  format: ImageFormatSpec;
  audit: ResolvedAuditSettings;
  /** Optional logger for per-attempt generation/audit diagnostics. */
  onEvent?: (message: string, err?: unknown) => void;
}

/**
 * Render one format and — when auditing is on — review it against the prompt,
 * regenerating until it passes or `audit.maxAttempts` is reached.
 *
 * Behavior:
 *   - Audit OFF → a single generation; the image is returned as-is (`passed`
 *     true). Identical to calling `generateOneImage` directly, but resilient:
 *     a generation error is captured (image null) instead of thrown.
 *   - Audit ON → up to `maxAttempts` rounds of generate→audit. The first image
 *     that passes is returned immediately. If none passes, the failure action
 *     decides: "publish" returns the last generated image anyway (`passed`
 *     false); "skip" returns `image: null` so the caller attaches nothing.
 *
 * Resilience: a generation OR audit infrastructure error never throws out of
 * here. A generation error counts as a failed attempt and retries. An audit
 * error fails OPEN — the just-generated image is accepted — so a momentarily
 * unreachable judge never discards a perfectly good image or burns the budget.
 */
export async function generateAuditedImage({
  model,
  systemPrompt,
  subject,
  format,
  audit,
  onEvent,
}: GenerateAuditedImageArgs): Promise<AuditedImageOutcome> {
  const maxAttempts = audit.enabled ? Math.max(1, audit.maxAttempts) : 1;
  let last: GeneratedImage | null = null;
  let reason: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let image: GeneratedImage | null = null;
    try {
      image = await generateOneImage({ model, systemPrompt, subject, format });
      last = image;
    } catch (err) {
      reason = err instanceof Error ? err.message : String(err);
      onEvent?.(`generation failed (attempt ${attempt}/${maxAttempts})`, err);
      continue; // retry the next attempt
    }

    if (!audit.enabled)
      return { format, image, passed: true, attempts: attempt };

    try {
      const verdict = await auditGeneratedImage({
        bytes: image.data,
        mediaType: image.mimetype,
        subject,
        format,
        model: audit.model,
        instructions: audit.instructions,
      });
      reason = verdict.reason;
      if (verdict.pass) {
        return { format, image, passed: true, attempts: attempt, reason };
      }
      onEvent?.(
        `audit rejected (attempt ${attempt}/${maxAttempts}): ${verdict.reason}`,
      );
    } catch (err) {
      // Audit infra failure — accept this image rather than discard it.
      onEvent?.(
        `audit unavailable (attempt ${attempt}/${maxAttempts}) — accepting image`,
        err,
      );
      return {
        format,
        image,
        passed: true,
        attempts: attempt,
        reason: "audit unavailable",
      };
    }
  }

  // Every attempt failed the audit (or generation never produced an image).
  if (audit.failureAction === "skip") {
    return {
      format,
      image: null,
      passed: false,
      attempts: maxAttempts,
      reason,
    };
  }
  return { format, image: last, passed: false, attempts: maxAttempts, reason };
}

// Preset format sets + ImageFormatSpec live in ./image-formats (server-free) so
// collection configs can import them without pulling in `ai`/`sharp`. Re-export
// here for convenience (server callers can import everything from one module).
export * from "./image-formats";
