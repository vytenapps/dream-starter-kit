import "server-only";

import type { Payload, TypedUser } from "payload";

import { isAiGatewayConfigured } from "@acme/config";

import { generateImages } from "../image-generation";
import { IMAGE_FORMAT_PRESETS, SQUARE_FORMAT } from "../image-formats";
import { isS3Configured } from "../s3-config";
import { resolveImageGenerationSettings } from "../../payload/hooks/generate-images";

/**
 * Host-side implementation of the MCP `generate_media` tool (injected into the
 * tool context as `ctx.generateMedia`, so `@acme/mcp` stays free of `ai`/`sharp`).
 *
 * Renders ONE image from a prompt via the AI Gateway, normalizes it, and creates
 * a Media doc AS THE STAFF USER (`overrideAccess: false`) so Payload's role-based
 * access control applies exactly as in /admin (golden rule #6). Same guards as
 * the collection hook (S3 configured, gateway reachable, kill switch).
 */
export async function generateMediaAsset(
  payload: Payload,
  user: TypedUser,
  args: { prompt: string; format?: "hero" | "og" | "square"; alt?: string },
): Promise<{ id: number | string; url: string | null; alt: string }> {
  if (!isS3Configured()) {
    throw new Error(
      "S3 storage is not configured — set S3 keys or the Supabase env.",
    );
  }
  if (!isAiGatewayConfigured()) {
    throw new Error(
      "AI Gateway is not configured (AI_GATEWAY_API_KEY / Vercel OIDC).",
    );
  }
  const settings = await resolveImageGenerationSettings(payload);
  if (!settings.enabled) {
    throw new Error("Image generation is disabled in image-generation-settings.");
  }

  const spec = args.format ? IMAGE_FORMAT_PRESETS[args.format] : SQUARE_FORMAT;
  const [image] = await generateImages({
    prompt: args.prompt,
    model: settings.model,
    systemPrompt: settings.systemPrompt,
    formats: [spec ?? SQUARE_FORMAT],
  });
  if (!image) throw new Error("The model returned no image.");

  const altText = args.alt?.trim() ? args.alt.trim() : args.prompt;
  const doc = await payload.create({
    collection: "media",
    data: { alt: altText },
    file: {
      data: image.data,
      mimetype: "image/webp",
      name: `generated-${image.format.key}-${Date.now()}.webp`,
      size: image.data.length,
    },
    overrideAccess: false,
    user,
  });

  return {
    id: doc.id,
    url: (doc as { url?: string | null }).url ?? null,
    alt: altText,
  };
}
