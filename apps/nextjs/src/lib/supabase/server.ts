import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@acme/api/types";

import { env } from "~/env";

/**
 * Server Supabase client for Server Components, Route Handlers, and Server
 * Actions. Reads/writes the session cookie. In a plain Server Component the
 * cookie write is a no-op (caught below); middleware refreshes the session
 * (added in Phase 3).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component without a writable cookie store.
            // Safe to ignore — middleware will refresh the session (Phase 3).
          }
        },
      },
    },
  );
}
