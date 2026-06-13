import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@acme/api/types";

import { env, supabaseAnonKey } from "~/env";

/**
 * Refreshes the Supabase auth session on every request (rotates the cookie) and
 * returns the current user so middleware can gate protected routes. Based on the
 * @supabase/ssr middleware pattern.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // `supabase` is returned so callers can run follow-up reads (e.g. the /admin
  // staff-gate) on the same refreshed session without building a second client.
  return { response, user, supabase };
}
