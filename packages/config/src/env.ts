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

  // --- Stripe — optional until Phase 5 is configured ---
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PRICE_MONTHLY: z.string().min(1).optional(),
  STRIPE_PRICE_YEARLY: z.string().min(1).optional(),

  // --- Payload CMS (server-only; content lives in the `cms` Postgres schema) ---
  /** Postgres connection for the least-privilege `payload_cms` role (search_path=cms). */
  PAYLOAD_DATABASE_URL: z.string().min(1).optional(),
  /** Payload encryption/JWT secret. Required once Payload is enabled. */
  PAYLOAD_SECRET: z.string().min(1).optional(),
  // Supabase Storage (S3) — Payload media bucket (`cms-media`).
  S3_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).default("cms-media"),
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
