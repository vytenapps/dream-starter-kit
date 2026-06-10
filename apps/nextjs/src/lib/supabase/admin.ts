import { createClient } from "@supabase/supabase-js";

import type { Database } from "@acme/api/types";

import { env } from "~/env";

/**
 * Service-role Supabase client — BYPASSES RLS (golden rule #2: server-only).
 * This module must only ever be imported from server code (route handlers,
 * Payload hooks); t3-env throws if a server var is read in the browser, and
 * nothing client-side imports it. Used for privileged admin work the user's
 * own RLS session can't do — currently the staff-invite hook (sending
 * `auth.admin.inviteUserByEmail` and flagging `profiles.is_staff`).
 */
export function createAdminClient() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — staff invites (and other admin " +
        "server routes) need it. Copy it from `supabase status` (local) or the " +
        "Supabase dashboard, into .env — see .env.example.",
    );
  }
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    // No session to persist/refresh — this client authenticates by key alone.
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
