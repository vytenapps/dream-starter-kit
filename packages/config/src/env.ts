import { z } from "zod/v4";

/**
 * SERVER-ONLY environment schema.
 *
 * Used by Supabase edge functions, Next.js server code, and Node scripts.
 * NEVER import this into a client/mobile bundle — it describes secrets
 * (service role key, Stripe secret, AI gateway key, Payload secret/DB). Client-safe
 * values are validated separately, per platform, with the `*_PUBLIC_` prefix.
 *
 * @see docs/ARCHITECTURE.md and `.env.example`
 */
export const serverEnvSchema = z.object({
  // --- Supabase ---
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  /** Bypasses RLS. Server/edge only — never shipped to a client. */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  /** Direct Postgres connection for migrations/seeds (optional at runtime). */
  SUPABASE_DB_URL: z.url().optional(),

  // --- App ---
  APP_URL: z.url().default("http://localhost:3000"),

  // --- AI (Vercel AI Gateway) — optional until Phase 6 is configured ---
  AI_GATEWAY_API_KEY: z.string().min(1).optional(),
  /**
   * OpenAI key for voice transcription (the chat extension's /transcribe
   * route). The AI Gateway doesn't proxy /audio/transcriptions, so Whisper is
   * called directly. Optional — voice input is off until this is set.
   */
  OPENAI_API_KEY: z.string().min(1).optional(),
  /**
   * Optional overrides for core CMS image generation (apps/nextjs image-generation
   * lib). Both optional — generation defaults through `@acme/config`
   * (DEFAULT_IMAGE_MODEL / DEFAULT_IMAGE_SYSTEM_PROMPT) and the
   * `image-generation-settings` global wins over both at runtime. Model slugs
   * live ONLY in `@acme/config` (golden rule #5); IMAGE_GENERATION_MODEL is a
   * deploy-time pin, not a new source of slugs.
   */
  IMAGE_GENERATION_MODEL: z.string().min(1).optional(),
  IMAGE_GENERATION_SYSTEM_PROMPT: z.string().min(1).optional(),

  // --- Chat channel adapters (optional; each adapter is off until set) ---
  // Slack (ext-chat-adapter-slack) — Events API webhook + chat.postMessage.
  SLACK_BOT_TOKEN: z.string().min(1).optional(),
  SLACK_SIGNING_SECRET: z.string().min(1).optional(),
  // Sendblue (ext-chat-adapter-sendblue) — iMessage/SMS in + out.
  SENDBLUE_API_KEY: z.string().min(1).optional(),
  SENDBLUE_API_SECRET: z.string().min(1).optional(),
  SENDBLUE_FROM_NUMBER: z.string().min(1).optional(),
  SENDBLUE_WEBHOOK_SECRET: z.string().min(1).optional(),
  SENDBLUE_STATUS_CALLBACK_URL: z.string().url().optional(),
  // Optional GitHub token to raise rate limits for the ext-docs GitHub sync.
  GITHUB_TOKEN: z.string().min(1).optional(),

  // --- Stripe — optional until Phase 5 is configured ---
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  /**
   * Signing secret for the Payload Stripe webhook endpoint
   * (/cms-api/stripe/webhooks) — a SECOND Stripe endpoint, separate from the
   * Supabase edge function's STRIPE_WEBHOOK_SECRET.
   */
  STRIPE_WEBHOOKS_ENDPOINT_SECRET: z.string().min(1).optional(),
  STRIPE_PRICE_MONTHLY: z.string().min(1).optional(),
  STRIPE_PRICE_YEARLY: z.string().min(1).optional(),

  // --- Payload CMS (server-only; content lives in the `cms` Postgres schema) ---
  /** Postgres connection for the least-privilege `payload_cms` role (search_path=cms). */
  PAYLOAD_DATABASE_URL: z.string().min(1).optional(),
  /** Payload encryption/JWT secret. Required once Payload is enabled. */
  PAYLOAD_SECRET: z.string().min(1).optional(),
  /** Shared secret guarding the draft-preview entry route (`/next/preview`). */
  PAYLOAD_PREVIEW_SECRET: z.string().min(1).optional(),
  // Supabase Storage (S3) — Payload media bucket (`cms-media`).
  S3_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).default("cms-media"),

  // --- Remote MCP server (packages/mcp) — optional until configured ---
  /**
   * HMAC secret the MCP OAuth server signs access-token JWTs with. The remote
   * MCP server (/mcp + /oauth/*) is OFF until this is set; `isMcpConfigured()`
   * gates it. Generate with `openssl rand -base64 32`.
   */
  MCP_JWT_SECRET: z.string().min(1).optional(),
  /** Explicit kill switch — set to "off" to disable MCP even when the secret is present. */
  MCP_ENABLED: z.enum(["on", "off"]).optional(),
  /**
   * Shared secret guarding scheduled worker endpoints (the in-app notifications
   * dispatch route, and the `reminders-process` edge function). Sent as a bearer
   * token by Vercel Cron / pg_cron.
   */
  CRON_SECRET: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Client-safe schema (logical names, no secrets). Each app maps its
 * platform-prefixed vars (`NEXT_PUBLIC_*` / `EXPO_PUBLIC_*`) onto these names
 * before validating, so the validation rules live in one place.
 */
export const clientEnvSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  APP_URL: z.url(),
  /** Origin of the Payload REST API (the web app). Mobile reads content from here. */
  CMS_URL: z.url().optional(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Is the Vercel AI Gateway reachable? Two valid auth paths (see
 * https://vercel.com/docs/ai-gateway/authentication-and-byok): an explicit
 * `AI_GATEWAY_API_KEY` (set locally or in any host), OR the `VERCEL_OIDC_TOKEN`
 * that Vercel injects automatically on its own deployments — the AI SDK reads
 * either. Gate AI routes on this, not on the API key alone, so a Vercel deploy
 * running purely on Gateway credits (no explicit key) isn't falsely rejected
 * with a 503. `VERCEL_OIDC_TOKEN` is runtime-injected, so it's read from
 * `process.env` directly rather than the zod schema.
 */
export function isAiGatewayConfigured(
  source: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(source.AI_GATEWAY_API_KEY ?? source.VERCEL_OIDC_TOKEN);
}

/**
 * Is the remote MCP server enabled? Needs a signing secret AND not explicitly
 * switched off. Routes (`/mcp`, `/oauth/*`, `/.well-known/oauth-*`) gate on this
 * so a deploy without `MCP_JWT_SECRET` simply 404s the MCP surface instead of
 * exposing half-configured OAuth endpoints.
 */
export function isMcpConfigured(
  source: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(source.MCP_JWT_SECRET) && source.MCP_ENABLED !== "off";
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

/**
 * Parse & validate the server environment. Throws a readable, aggregated error
 * listing every missing/malformed variable so the app fails loudly on boot
 * rather than at some random call site later.
 */
export function parseServerEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `Invalid server environment variables:\n${formatIssues(parsed.error)}\n` +
        `See .env.example for the full list.`,
    );
  }
  return parsed.data;
}

/** Parse & validate a client environment (logical names). Throws on error. */
export function parseClientEnv(
  source: Record<string, string | undefined>,
): ClientEnv {
  const parsed = clientEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `Invalid client environment variables:\n${formatIssues(parsed.error)}\n` +
        `See .env.example for the full list.`,
    );
  }
  return parsed.data;
}
