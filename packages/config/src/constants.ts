/**
 * App-wide constants shared by web + native + edge functions.
 * Keep cross-platform values here so there is a single source of truth.
 */

export const APP_NAME = "Dream";

/**
 * Kit version — the extension framework's compatibility anchor. Extension
 * manifests declare a `kitCompat` semver range checked against this at
 * add/update/sync time. MUST match the root package.json `version` (a unit
 * test in this package asserts it). Bump the major for breaking changes to
 * the extension API surface (@acme/ext-kit contracts, registry shapes).
 */
export const KIT_VERSION = "1.0.0";

/**
 * Default AI model — a Vercel AI Gateway "provider/model" slug.
 *
 * IMPORTANT: Gateway slugs change frequently. This is the single source of
 * truth; swapping models is a one-line change here. Where practical, resolve
 * the live list at runtime via `gateway.getAvailableModels()` and fall back to
 * this default. See docs/ARCHITECTURE.md.
 */
export const DEFAULT_AI_MODEL = "anthropic/claude-sonnet-4.5";

/** Ordered fallbacks if the default model is unavailable at runtime. */
export const AI_MODEL_FALLBACKS = [
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-opus-4.1",
] as const;

/** Cost guardrail: max tokens a single AI response may generate (Phase 6). */
export const AI_MAX_OUTPUT_TOKENS = 2048;

/**
 * Curated chat-model catalog for the /a/chat model selector (gateway slugs —
 * golden rule #5: model ids live ONLY here). The chat extension serves this
 * via GET /api/ext/chat/models; the default is DEFAULT_AI_MODEL.
 */
export const CHAT_MODELS = [
  {
    id: "anthropic/claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    description: "Fast, capable default with tool use",
  },
  {
    id: "anthropic/claude-opus-4.1",
    name: "Claude Opus 4.1",
    provider: "anthropic",
    description: "Most capable model for complex work",
  },
  {
    id: "anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "Fastest and most economical",
  },
] as const;

/**
 * Small/fast model for auxiliary AI work: skill routing fallback
 * classification and chat title generation.
 */
export const ROUTING_AI_MODEL = "anthropic/claude-haiku-4.5";

/**
 * Default transcription model ("provider/model"). Only OpenAI is wired up —
 * the AI Gateway doesn't proxy /audio/transcriptions, so transcription calls
 * OpenAI directly with OPENAI_API_KEY.
 */
export const DEFAULT_TRANSCRIPTION_MODEL = "openai/whisper-1";

/**
 * Chat channels the assistant can speak through. "web"/"native" are the
 * in-app surfaces; the rest map to Chat SDK adapters (chat-sdk.dev/adapters)
 * wired up as ext-chat-adapter-<channel> extensions. Channel-scoped
 * sub-prompts in the chat settings target these slugs.
 */
export const CHAT_CHANNELS = [
  "web",
  "native",
  "slack",
  "sms-sendblue",
  "telegram",
  "whatsapp",
  "discord",
  "teams",
  "google-chat",
  "messenger",
  "email",
  "twilio-sms",
  "github",
  "linear",
] as const;
export type ChatChannel = (typeof CHAT_CHANNELS)[number];

/** Default Supabase Storage bucket for user uploads (see docs/ERD.md `files`). */
export const DEFAULT_STORAGE_BUCKET = "user-files";

/**
 * Default image-generation model — a Vercel AI Gateway image-model slug
 * (golden rule #5: image model ids live ONLY here, like DEFAULT_AI_MODEL).
 *
 * Used by the core CMS image-generation lib (apps/nextjs/src/lib/image-generation.ts)
 * to render content/Media artwork from a text prompt. Swapping the default model
 * is a one-line change here; the `image-generation-settings` global can override
 * it per-workspace and `IMAGE_GENERATION_MODEL` (env) sits in between. See
 * docs/ARCHITECTURE.md → image generation.
 */
export const DEFAULT_IMAGE_MODEL = "google/imagen-4.0-generate-001";

/**
 * Curated catalog of image-generation models offered in the
 * `image-generation-settings` global's `model` select (gateway image-model
 * slugs — golden rule #5: the only place these live). Keep the default first.
 */
export const IMAGE_GENERATION_MODELS = [
  {
    id: "google/imagen-4.0-generate-001",
    name: "Imagen 4",
    provider: "google",
    description: "Google's high-quality general-purpose image model (default).",
  },
  {
    id: "google/imagen-4.0-fast-generate-001",
    name: "Imagen 4 Fast",
    provider: "google",
    description: "Faster, cheaper Imagen 4 — good for bulk thumbnails.",
  },
  {
    id: "openai/gpt-image-1",
    name: "GPT Image 1",
    provider: "openai",
    description: "OpenAI's image model with strong prompt adherence.",
  },
  {
    id: "bfl/flux-pro-1.1",
    name: "FLUX Pro 1.1",
    provider: "bfl",
    description: "Black Forest Labs FLUX — photoreal, fast.",
  },
] as const;

export type ImageGenerationModelId = (typeof IMAGE_GENERATION_MODELS)[number]["id"];

/**
 * Default art-direction system prompt prepended to every image-generation
 * request. Deliberately steers toward bold, minimal, flat illustration with NO
 * text/logos (generated text is unreliable and looks broken). Overridable via
 * the `image-generation-settings` global or `IMAGE_GENERATION_SYSTEM_PROMPT`.
 */
export const DEFAULT_IMAGE_SYSTEM_PROMPT =
  "Bold, minimal, modern flat illustration with clean shapes and a cohesive, " +
  "vibrant color palette. Strong focal subject, generous negative space, soft " +
  "studio lighting. No text, no words, no letters, no logos, no watermarks, no " +
  "UI chrome. High quality, professional, editorial.";

/** Cost guardrail: max image formats a single generation request may render. */
export const IMAGE_GENERATION_MAX_FORMATS = 6;

/**
 * Subscription plans — a single "Pro" product billed monthly or yearly.
 * Display lives here (cross-platform); the matching Stripe price ids are
 * server-only env (STRIPE_PRICE_MONTHLY / STRIPE_PRICE_YEARLY). The server maps
 * a plan `id` to its price id at checkout, so price ids never reach the client.
 */
export const PLANS = [
  {
    id: "monthly",
    name: "Monthly",
    price: "$9.99",
    cadence: "/mo",
    interval: "month",
  },
  {
    id: "yearly",
    name: "Yearly",
    price: "$99",
    cadence: "/yr",
    interval: "year",
    badge: "Save 17%",
  },
] as const;

export type PlanId = (typeof PLANS)[number]["id"];
