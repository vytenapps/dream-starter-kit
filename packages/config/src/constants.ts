/**
 * App-wide constants shared by web + native + edge functions.
 * Keep cross-platform values here so there is a single source of truth.
 */

export const APP_NAME = "Dream";

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

/** Default Supabase Storage bucket for user uploads (see docs/ERD.md `files`). */
export const DEFAULT_STORAGE_BUCKET = "user-files";

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
