import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod/v4";

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
  },
  /** Client-safe — compiled into the browser bundle (publishable/anon only). */
  client: {
    // Build-time placeholders so a one-click / v0 deploy builds with no env set.
    // They're baked into the bundle, so the deployed app is non-functional until
    // you set the real values (e.g. the Vercel Supabase integration) AND redeploy.
    // Locally, set them in `.env` (see .env.example). The URL must stay a valid URL.
    NEXT_PUBLIC_SUPABASE_URL: z.url().default("http://127.0.0.1:54321"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z
      .string()
      .min(1)
      .default("set-in-vercel-env"),
    NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
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
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
