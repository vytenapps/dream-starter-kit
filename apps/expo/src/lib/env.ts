import { parseClientEnv } from "@acme/config/env";

/**
 * Native client environment.
 *
 * `EXPO_PUBLIC_*` vars are inlined at build time, so they MUST be read as
 * literal `process.env.EXPO_PUBLIC_X` accesses (not dynamically). We validate
 * them with the shared zod schema from `@acme/config` so a missing/malformed
 * value fails loudly instead of surfacing as a confusing runtime error.
 */
export const clientEnv = parseClientEnv({
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  APP_URL: process.env.EXPO_PUBLIC_API_URL,
});
