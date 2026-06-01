import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@acme/api/types";

import { env } from "~/env";

/**
 * Browser Supabase client (cookie-based session via @supabase/ssr).
 * Use in Client Components. Server Components use `~/lib/supabase/server`.
 */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
