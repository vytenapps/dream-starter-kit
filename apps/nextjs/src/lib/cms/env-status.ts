import type { CmsCredentialSource } from "./derived-credentials";
import { resolveCmsCredentials } from "./derived-credentials";

/**
 * Effective CMS configuration state. The CMS needs a Payload secret and the
 * payload_cms connection string, but neither has to be set by hand: when
 * PAYLOAD_SECRET / PAYLOAD_DATABASE_URL are absent they're derived from the
 * Supabase env the Vercel integration injects (see ./derived-credentials).
 * They stay OPTIONAL in the zod schema (a bare one-click deploy must still
 * build and serve the non-CMS app), so the fail-loudly point is request
 * time: /admin, /cms-api and /api/cms/seed answer a clear 503 explaining
 * what to set instead of Payload's opaque "missing secret key" digest.
 */
export interface CmsConfigStatus {
  /** explicit = both vars set; derived = at least one filled by derivation. */
  mode: "explicit" | "derived" | "unconfigured";
  configured: boolean;
  /** What's unresolvable — names only, never values. */
  missing: string[];
}

export function cmsConfigStatus(source?: CmsCredentialSource): CmsConfigStatus {
  const creds = resolveCmsCredentials(source);
  const missing: string[] = [];
  if (!creds.secret) missing.push("PAYLOAD_SECRET");
  if (!creds.databaseUrl) missing.push("PAYLOAD_DATABASE_URL");
  if (missing.length > 0) {
    return { mode: "unconfigured", configured: false, missing };
  }
  return {
    mode:
      creds.derived.secret || creds.derived.databaseUrl
        ? "derived"
        : "explicit",
    configured: true,
    missing: [],
  };
}

/**
 * Founder-facing explanation, safe for anonymous eyes (variable NAMES only,
 * never values). Served as plain text by the /admin gate and as JSON by the
 * seed endpoint.
 */
export function cmsNotConfiguredMessage(missing: string[]): string {
  return (
    `CMS not configured on this deployment: set ${missing.join(" and ")} ` +
    "in your hosting env — or connect the Vercel<->Supabase integration " +
    "(SUPABASE_SERVICE_ROLE_KEY + POSTGRES_URL / POSTGRES_URL_NON_POOLING) and " +
    "the kit derives them automatically — then redeploy. See the README's " +
    '"Content backend (Payload CMS)" section; deployment status is at ' +
    "/api/health/db."
  );
}
