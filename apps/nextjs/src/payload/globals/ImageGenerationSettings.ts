import type { GlobalConfig } from "payload";

import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_SYSTEM_PROMPT,
  IMAGE_GENERATION_MODELS,
} from "@acme/config";

import { isStaff } from "../access";

/**
 * Workspace settings for core CMS image generation (System → Image Generation).
 * Collection-agnostic — governs generation for ANY image-enabled content type
 * and the Media library, not one collection.
 *
 * Resolution order at generation time is global → env → code default
 * (see payload/hooks/generate-images.ts → resolveImageGenerationSettings):
 *   - `enabled` — kill switch. When off, the beforeChange hook no-ops (the
 *     underlying write still commits) so staff can pause spend instantly.
 *   - `model`   — gateway image-model slug, from the IMAGE_GENERATION_MODELS
 *     catalog in @acme/config (golden rule #5: slugs live only there).
 *   - `systemPrompt` — art direction prepended to every prompt.
 *
 * Staff-only. The model `select` options come from the central catalog.
 */
export const ImageGenerationSettings: GlobalConfig = {
  slug: "image-generation-settings",
  label: "Image Generation",
  admin: {
    group: "System",
    description:
      "Auto-generate content images from a text prompt (the `imagePrompt` " +
      "field on image-enabled collections and the generate_media MCP tool). " +
      "Renders via the Vercel AI Gateway and stores results in the Media library.",
  },
  access: { read: isStaff, update: isStaff },
  fields: [
    {
      name: "enabled",
      type: "checkbox",
      defaultValue: true,
      admin: {
        description:
          "Master switch. When off, saving a doc with an imagePrompt does NOT " +
          "generate images (the save still succeeds).",
      },
    },
    {
      name: "model",
      type: "select",
      defaultValue: DEFAULT_IMAGE_MODEL,
      options: IMAGE_GENERATION_MODELS.map((m) => ({
        label: `${m.name} — ${m.description}`,
        value: m.id,
      })),
      admin: {
        description: "Image model used for generation (AI Gateway slug).",
      },
    },
    {
      name: "systemPrompt",
      type: "textarea",
      admin: {
        description:
          "Art-direction prompt prepended to every generation. Leave blank to " +
          `use the built-in default:\n${DEFAULT_IMAGE_SYSTEM_PROMPT}`,
      },
    },
  ],
};
