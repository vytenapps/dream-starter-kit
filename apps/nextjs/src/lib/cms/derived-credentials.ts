import { createHmac } from "node:crypto";

import { env } from "../../env";
import { CMS_ROLE, resolveAdminDbUrl } from "../db/bootstrap-core";

/**
 * Zero-touch CMS credentials. The Vercel<->Supabase integration injects the
 * Supabase env (SUPABASE_SERVICE_ROLE_KEY, POSTGRES_URL_NON_POOLING, ...) but
 * has no idea about Payload — so a fresh clone-and-connect deploy used to die
 * on /admin with "missing secret key" until the founder hand-set
 * PAYLOAD_SECRET and PAYLOAD_DATABASE_URL.
 *
 * Instead, when those two are unset, both are DERIVED deterministically from
 * the service-role key (HMAC-SHA256 with fixed context strings):
 *
 *   - PAYLOAD_SECRET            ← hmac(serviceRoleKey, "…payload-secret")
 *   - payload_cms role password ← hmac(serviceRoleKey, "…payload-db-password")
 *
 * and the connection string is built from the same session-mode admin URL the
 * runtime DB bootstrap uses (which also CREATES the role with that derived
 * password on first boot — see lib/db/bootstrap.ts#provisionCms). The inputs
 * and outputs are all server-only secrets in the same trust domain — the
 * service-role key already bypasses RLS entirely, so the derived
 * least-privilege role expands nothing.
 *
 * Setting PAYLOAD_SECRET / PAYLOAD_DATABASE_URL explicitly always wins.
 * Caveat (documented in the README): rotating SUPABASE_SERVICE_ROLE_KEY
 * changes the derived values — after a rotation either set the explicit vars
 * or update the payload_cms role password to the new derived one.
 */
const SECRET_CONTEXT = "dream-starter-kit:payload-secret";
const PASSWORD_CONTEXT = "dream-starter-kit:payload-db-password";

/** Percent-encoded `options=-c search_path=cms` — Payload's required setting. */
const SEARCH_PATH_PARAM = "options=-c%20search_path%3Dcms";

function hmacHex(seed: string, context: string): string {
  return createHmac("sha256", seed).update(context).digest("hex");
}

export function derivePayloadSecret(seed: string): string {
  return hmacHex(seed, SECRET_CONTEXT);
}

export function derivePayloadPassword(seed: string): string {
  return hmacHex(seed, PASSWORD_CONTEXT);
}

/**
 * Rewrites the privileged admin connection string into the payload_cms one:
 * swaps the userinfo for `payload_cms[.tenant]:<password>` (Supavisor pooler
 * URLs address the project via the username suffix — `postgres.<ref>` →
 * `payload_cms.<ref>`; the Postgres ROLE name stays `payload_cms`), keeps
 * host/port/path/query byte-for-byte, and appends the required
 * `search_path=cms` options param. The derived password is hex, so no
 * percent-encoding is needed.
 *
 * Returns undefined when the URL can't be safely rewritten (unparseable, or
 * it already carries an `options=` param we'd conflict with — set
 * PAYLOAD_DATABASE_URL explicitly in that case).
 */
export function derivePayloadDatabaseUrl(
  adminUrl: string,
  password: string,
): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(adminUrl);
  } catch {
    return undefined;
  }
  if (!parsed.hostname || parsed.searchParams.has("options")) {
    return undefined;
  }

  const adminUser = decodeURIComponent(parsed.username);
  const dot = adminUser.indexOf(".");
  const user = dot === -1 ? CMS_ROLE : `${CMS_ROLE}${adminUser.slice(dot)}`;

  // String surgery (never URL.toString()) so the rest of the URL — host,
  // port, db name, query params like sslmode/supa — stays byte-identical.
  const schemeEnd = adminUrl.indexOf("://") + 3;
  const pathStart = adminUrl.indexOf("/", schemeEnd);
  const authorityEnd = pathStart === -1 ? adminUrl.length : pathStart;
  const authority = adminUrl.slice(schemeEnd, authorityEnd);
  const at = authority.lastIndexOf("@");
  const hostPart = at === -1 ? authority : authority.slice(at + 1);
  const rest = adminUrl.slice(authorityEnd);

  const base = `${adminUrl.slice(0, schemeEnd)}${user}:${password}@${hostPart}${rest}`;
  return base.includes("?")
    ? `${base}&${SEARCH_PATH_PARAM}`
    : `${base}?${SEARCH_PATH_PARAM}`;
}

export interface CmsCredentialSource {
  PAYLOAD_SECRET?: string;
  PAYLOAD_DATABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_DB_URL?: string;
  POSTGRES_URL?: string;
  POSTGRES_URL_NON_POOLING?: string;
}

export interface CmsCredentials {
  secret: string | undefined;
  databaseUrl: string | undefined;
  /** Which of the two came from derivation rather than explicit env. */
  derived: { secret: boolean; databaseUrl: boolean };
}

/** Empty strings count as absent, matching the rest of the kit. */
const nonEmpty = (value: string | undefined): string | undefined =>
  value === undefined || value === "" ? undefined : value;

/** Explicit env wins; derivation fills the gaps when the seed inputs exist. */
export function resolveCmsCredentials(
  source: CmsCredentialSource = env,
): CmsCredentials {
  const seed = nonEmpty(source.SUPABASE_SERVICE_ROLE_KEY);
  let secret = nonEmpty(source.PAYLOAD_SECRET);
  let databaseUrl = nonEmpty(source.PAYLOAD_DATABASE_URL);
  const derived = { secret: false, databaseUrl: false };

  if (!secret && seed) {
    secret = derivePayloadSecret(seed);
    derived.secret = true;
  }
  if (!databaseUrl && seed) {
    const adminUrl = resolveAdminDbUrl({
      SUPABASE_DB_URL: source.SUPABASE_DB_URL,
      POSTGRES_URL: source.POSTGRES_URL,
      POSTGRES_URL_NON_POOLING: source.POSTGRES_URL_NON_POOLING,
    });
    if (adminUrl) {
      databaseUrl = derivePayloadDatabaseUrl(
        adminUrl,
        derivePayloadPassword(seed),
      );
      derived.databaseUrl = databaseUrl !== undefined;
    }
  }

  return { secret, databaseUrl, derived };
}
