import "server-only";

import { generateObject } from "ai";
import { z } from "zod/v4";

import { DEFAULT_IMAGE_AUDIT_MODEL } from "@acme/config";

import type { ImageFormatSpec } from "./image-formats";

/**
 * Vision-model audit of a generated CMS image (server-only — imports `ai`).
 *
 * After the renderer (lib/image-generation.ts) produces an image, this asks a
 * vision-capable model (via the Vercel AI Gateway) whether the image actually
 * meets the prompt's requirements — does it depict the subject, is it free of
 * text/logos, is it usable? The generate→audit loop
 * (lib/image-generation.ts#generateAuditedImage) regenerates images that fail,
 * up to a configurable max-attempts.
 *
 * The pure prompt composition (`buildAuditPrompt`) is exported for unit tests;
 * the image bytes are attached separately as an image message part.
 */

/** Structured verdict the audit model returns. */
const auditSchema = z.object({
  meetsRequirements: z
    .boolean()
    .describe(
      "True only if the image is an acceptable thumbnail for the prompt.",
    ),
  reason: z.string().describe("One short sentence explaining the verdict."),
});

export interface ImageAuditVerdict {
  /** Whether the image meets the prompt's requirements. */
  pass: boolean;
  /** Short human-readable explanation (surfaced in logs). */
  reason: string;
}

export interface AuditGeneratedImageArgs {
  /** Raw image bytes (the normalized webp produced by the generator). */
  bytes: Buffer;
  /** Image media type, e.g. "image/webp". */
  mediaType: string;
  /** The doc's `imagePrompt` — the subject the image is meant to depict. */
  subject: string;
  /** Which format was generated (drives the size/composition criteria). */
  format: ImageFormatSpec;
  /** Gateway model slug for the audit. Defaults to DEFAULT_IMAGE_AUDIT_MODEL. */
  model?: string;
  /** Optional extra acceptance criteria from the workspace settings. */
  instructions?: string;
}

/**
 * Compose the instruction sent to the vision model that audits a generated
 * image. Pure/string-only so it is unit-testable without the `ai` stack. The
 * image itself is attached separately as an image message part; this is the
 * text half.
 *
 * The judge is deliberately strict: a thumbnail that doesn't clearly depict the
 * subject, or that carries text/logos/watermarks, or that is garbled/distorted,
 * should be rejected so it gets regenerated. Optional `instructions` let staff
 * layer extra, workspace-specific acceptance criteria on top.
 */
export function buildAuditPrompt(
  subject: string,
  format: ImageFormatSpec,
  instructions?: string,
): string {
  const extra = (instructions ?? "").trim();
  return [
    "You are a strict quality reviewer for AI-generated images.",
    `The attached image was generated to illustrate this subject: "${subject.trim()}".`,
    `It is the "${format.key}" format (${format.width}×${format.height}; ${format.composition}).`,
    "Decide whether the image faithfully and clearly depicts that subject and is usable as a clean, on-brand image.",
    "Reject it (meetsRequirements = false) if ANY of these is true: it does not depict the stated subject; " +
      "it contains text, words, letters, numbers, logos, or watermarks; it is garbled, distorted, deformed, or visually broken; " +
      "or it is otherwise low-quality or unusable.",
    extra ? `Additional requirements from the workspace: ${extra}` : "",
    "Respond with meetsRequirements (boolean) and a brief reason (one sentence).",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Ask the vision model whether `bytes` is an acceptable image for `subject`.
 * Throws on an infrastructure error (gateway unreachable, parse failure) — the
 * caller (`generateAuditedImage`) decides how to treat that (it fails OPEN so a
 * broken judge never discards an otherwise-fine image).
 */
export async function auditGeneratedImage({
  bytes,
  mediaType,
  subject,
  format,
  model = DEFAULT_IMAGE_AUDIT_MODEL,
  instructions,
}: AuditGeneratedImageArgs): Promise<ImageAuditVerdict> {
  const { object } = await generateObject({
    // Bare gateway slug passed straight to the AI SDK (it reads
    // AI_GATEWAY_API_KEY), matching the chat extension's model resolution.
    model,
    schema: auditSchema,
    maxOutputTokens: 512,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: buildAuditPrompt(subject, format, instructions),
          },
          { type: "image", image: bytes, mediaType },
        ],
      },
    ],
  });

  return { pass: object.meetsRequirements, reason: object.reason };
}
