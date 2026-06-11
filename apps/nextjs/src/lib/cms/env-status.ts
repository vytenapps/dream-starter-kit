// Relative (not the ~/env alias) so vitest resolves it — same as lib/db.
import { env } from "../../env";

/**
 * The env vars the CMS cannot run without. They're OPTIONAL in the zod schema
 * (a bare one-click deploy must still build and serve the non-CMS app), so the
 * fail-loudly point is request time: /admin, /cms-api and /api/cms/seed answer
 * a clear 503 naming the missing vars instead of Payload's opaque
 * "missing secret key" digest — the error a founder actually hit when the
 * Vercel<->Supabase integration injected the Supabase vars but nobody set the
 * Payload ones.
 */
export const CMS_REQUIRED_ENV = [
  "PAYLOAD_SECRET",
  "PAYLOAD_DATABASE_URL",
] as const;

type CmsEnvName = (typeof CMS_REQUIRED_ENV)[number];

/** Names of the CMS-required env vars missing from this deployment. */
export function missingCmsEnv(
  source: Partial<Record<CmsEnvName, string | undefined>> = env,
): string[] {
  // Treat empty strings as absent, matching the rest of the kit's env handling.
  return CMS_REQUIRED_ENV.filter((name) => !source[name]);
}

/**
 * Founder-facing explanation, safe for anonymous eyes (variable NAMES only,
 * never values). Served as plain text by the /admin gate and as JSON by the
 * seed endpoint.
 */
export function cmsNotConfiguredMessage(missing: string[]): string {
  return (
    `CMS not configured on this deployment: set ${missing.join(" and ")} ` +
    "in your hosting env (e.g. Vercel → Settings → Environment Variables), " +
    'then redeploy. See the README\'s "Content backend (Payload CMS)" ' +
    "section for the values; deployment status is at /api/health/db."
  );
}
