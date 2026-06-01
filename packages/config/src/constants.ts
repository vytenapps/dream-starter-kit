/**
 * App-wide constants shared by web + native + edge functions.
 * Keep cross-platform values here so there is a single source of truth.
 */

export const APP_NAME = "Meet Dream";

/**
 * Default AI model — a Vercel AI Gateway "provider/model" slug.
 *
 * IMPORTANT: Gateway slugs change frequently. This is the single source of
 * truth; swapping models is a one-line change here. Where practical, resolve
 * the live list at runtime via `gateway.getAvailableModels()` and fall back to
 * this default. See ARCHITECTURE.md §4.7.
 */
export const DEFAULT_AI_MODEL = "anthropic/claude-sonnet-4.5";

/** Ordered fallbacks if the default model is unavailable at runtime. */
export const AI_MODEL_FALLBACKS = [
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-opus-4.1",
] as const;

/** Cost guardrail: max tokens a single AI response may generate (Phase 6). */
export const AI_MAX_OUTPUT_TOKENS = 2048;

/** Default Supabase Storage bucket for user uploads (see ERD.md `files`). */
export const DEFAULT_STORAGE_BUCKET = "user-files";
