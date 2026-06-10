/**
 * Direct DB-state assertions for specs that need to verify what a UI flow
 * actually persisted (e.g. founder.setup.ts asserting sign-up created the
 * auth user + profile). Uses the SERVICE ROLE key from `.env` — fine here
 * because this is server-side test tooling, the same trust level as
 * tooling/rls-tests (golden rule #2: the key never ships in app/client code).
 */
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";

interface AdminUser {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  is_staff: boolean;
}

function serviceHeaders(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY missing from .env — required for DB-state " +
        "assertions. Locally `supabase status` prints it; CI provisions it.",
    );
  }
  return { apikey: key, Authorization: `Bearer ${key}` };
}

/** Look up the auth.users row for `email` via GoTrue's admin API. */
export async function fetchAuthUserByEmail(
  email: string,
): Promise<AdminUser | undefined> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
    headers: serviceHeaders(),
  });
  if (!res.ok) {
    throw new Error(`GoTrue admin user list failed: ${res.status}`);
  }
  const { users } = (await res.json()) as { users: AdminUser[] };
  return users.find((u) => u.email === email);
}

/** Read a public.profiles row by user id (PostgREST, service role). */
export async function fetchProfile(
  id: string,
): Promise<ProfileRow | undefined> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}&select=id,display_name,is_staff`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) {
    throw new Error(`profiles read failed: ${res.status}`);
  }
  const rows = (await res.json()) as ProfileRow[];
  return rows[0];
}
