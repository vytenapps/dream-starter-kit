import type { GlobalConfig } from "payload";

import {
  CHAT_MODELS,
  DEFAULT_IMAGE_AUDIT_MAX_ATTEMPTS,
  DEFAULT_IMAGE_AUDIT_MODEL,
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
    {
      name: "auditEnabled",
      type: "checkbox",
      defaultValue: false,
      label: "Audit images after generation",
      admin: {
        description:
          "When on, every generated image is reviewed by a vision model " +
          "against its prompt. Images that don't meet the prompt are " +
          "regenerated and re-audited, up to the max attempts below.",
      },
    },
    {
      name: "auditMaxAttempts",
      type: "number",
      defaultValue: DEFAULT_IMAGE_AUDIT_MAX_ATTEMPTS,
      min: 1,
      max: 10,
      label: "Max attempts",
      admin: {
        step: 1,
        condition: (data) => Boolean(data.auditEnabled),
        description:
          "How many times to generate + audit an image before giving up " +
          "(default 3).",
      },
    },
    {
      name: "auditFailureAction",
      type: "radio",
      defaultValue: "publish",
      options: [
        { label: "Publish the last generated image", value: "publish" },
        { label: "Skip upload (attach no image)", value: "skip" },
      ],
      label: "If the audit still fails after the max attempts",
      admin: {
        condition: (data) => Boolean(data.auditEnabled),
        description:
          "After the final failed attempt, either keep the last image anyway, " +
          "or skip it — leaving the slot empty so a later save can retry.",
      },
    },
    {
      name: "auditModel",
      type: "select",
      defaultValue: DEFAULT_IMAGE_AUDIT_MODEL,
      options: CHAT_MODELS.map((m) => ({
        label: `${m.name} — ${m.description}`,
        value: m.id,
      })),
      label: "Audit model",
      admin: {
        condition: (data) => Boolean(data.auditEnabled),
        description:
          "Vision model (AI Gateway slug) that reviews each generated image. " +
          "Must support image input.",
      },
    },
    {
      name: "auditInstructions",
      type: "textarea",
      label: "Extra audit criteria (optional)",
      admin: {
        condition: (data) => Boolean(data.auditEnabled),
        description:
          "Additional, workspace-specific acceptance rules layered on top of " +
          "the defaults (depicts the subject, no text/logos, not garbled).",
      },
    },
    {
      // "Regenerate all images" button: for every image-enabled collection
      // (see payload/image-collections.ts), re-renders every doc that has an
      // image prompt against the CURRENT settings above. Save the global first.
      // Backed by the staff-only /api/cms/regenerate-images route.
      name: "regenerateAll",
      type: "ui",
      admin: {
        components: {
          Field: "~/payload/components/RegenerateAllImages#RegenerateAllImages",
        },
      },
    },
  ],
};
