import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod/v4";

/**
 * Build-time placeholders for the public Supabase env. A one-click / v0 deploy
 * builds with no env set, so these get baked into the client bundle and the
 * deployed app can't reach Supabase until the real values are set AND the app
 * is redeployed. `isSupabaseConfigured()` (see `~/lib/supabase/config`) detects
 * this so the UI can warn instead of failing with a cryptic "Failed to fetch".
 * Keyed off the anon-key sentinel because the URL placeholder doubles as the
 * real local-dev URL, so it can't tell "unconfigured" apart from "local dev".
 */
export const SUPABASE_URL_PLACEHOLDER = "http://127.0.0.1:54321";
export const SUPABASE_ANON_KEY_PLACEHOLDER = "set-in-vercel-env";

/**
 * Web app environment. Server vars are secrets (never bundled to the client);
 * client vars MUST be `NEXT_PUBLIC_`-prefixed. The shared, platform-agnostic
 * schema lives in `@acme/config` (used by edge functions); this file is the
 * Next-specific, build-time-validated view of it.
 */
export const env = createEnv({
  extends: [vercel()],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  /** Server-only — secrets. Never exposed to the browser. */
  server: {
    // Optional for the web app (it uses anon + the user's token); Supabase
    // edge functions receive the service role from Supabase's injected env.
    // Set it here only if you add admin server routes that bypass RLS.
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    SUPABASE_DB_URL: z.url().optional(),
    AI_GATEWAY_API_KEY: z.string().min(1).optional(),
    STRIPE_SECRET_KEY: z.string().min(1).optional(),
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
    STRIPE_PRICE_MONTHLY: z.string().min(1).optional(),
    STRIPE_PRICE_YEARLY: z.string().min(1).optional(),
    // Payload CMS (server-only). Payload reads these directly from process.env
    // (incl. the `payload` CLI), so they're optional here; declared for typing
    // and to keep .env validated. See .env.example.
    PAYLOAD_DATABASE_URL: z.string().min(1).optional(),
    PAYLOAD_SECRET: z.string().min(1).optional(),
    S3_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().min(1).optional(),
    S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    S3_BUCKET: z.string().min(1).optional(),
  },
  /** Client-safe — compiled into the browser bundle (publishable/anon only). */
  client: {
    // Build-time placeholders so a one-click / v0 deploy builds with no env set.
    // They're baked into the bundle, so the deployed app is non-functional until
    // you set the real values (e.g. the Vercel Supabase integration) AND redeploy.
    // Locally, set them in `.env` (see .env.example). The URL must stay a valid URL.
    NEXT_PUBLIC_SUPABASE_URL: z.url().default(SUPABASE_URL_PLACEHOLDER),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z
      .string()
      .min(1)
      .default(SUPABASE_ANON_KEY_PLACEHOLDER),
    NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
    // Origin hosting the Payload REST API. In the browser the app reads content
    // same-origin (relative /cms-api); this is mainly for completeness/SSR.
    NEXT_PUBLIC_CMS_URL: z.url().optional(),
  },
  /**
   * Destructure from process.env so vars aren't tree-shaken away.
   */
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CMS_URL: process.env.NEXT_PUBLIC_CMS_URL,
  },
  // Do NOT skip on `process.env.CI`. Vercel sets CI=1 during builds, and when
  // validation is skipped `@t3-oss/env-nextjs` returns raw `process.env`
  // *without* applying the `.default()`s above — so `NEXT_PUBLIC_APP_URL` became
  // `undefined` and `next build` crashed on `new URL(undefined)` for a one-click
  // deploy with no env set. Letting validation run is what makes the documented
  // build-time placeholders actually take effect (and still fails loudly on a
  // genuinely malformed value). We only skip for `lint`, where eslint loads
  // `next.config.js` (which imports this file) but no real env is available.
  skipValidation: process.env.npm_lifecycle_event === "lint",
});
