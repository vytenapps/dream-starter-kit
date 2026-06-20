/**
 * S3 (Supabase Storage) configuration resolver for Payload's `s3Storage`
 * adapter. Two modes, in precedence order:
 *
 *  1. **Dedicated keys** — `S3_ACCESS_KEY_ID` + `S3_SECRET_ACCESS_KEY` (the
 *     local-dev / bring-your-own-bucket path; `.env.example`).
 *  2. **Supabase session-token mode** — when no dedicated S3 keys are set but
 *     the Supabase env is present (the Vercel↔Supabase integration injects only
 *     Supabase vars). Supabase Storage's S3 endpoint accepts the project's own
 *     credentials as: accessKeyId = project ref, secretAccessKey = anon key,
 *     sessionToken = service-role JWT. We DERIVE the endpoint
 *     (`https://<ref>.storage.supabase.co/storage/v1/s3`) and the region (from
 *     the Supavisor pooler host in `POSTGRES_URL`) so a clone-and-connect deploy
 *     needs ZERO S3-specific env.
 *
 * Explicit `S3_ENDPOINT` / `S3_REGION` always win over derivation.
 *
 * IMPORTANT (production bug, do not regress): in session-token mode the endpoint
 * AND region MUST be derived — without them the AWS SDK defaults to real AWS S3
 * and every upload fails with `InvalidAccessKeyId`.
 *
 * Reads a raw env-shaped object (not the validated `~/env`): `payload.config.ts`
 * loads under the Payload CLI without full env validation, so it casts
 * `process.env as S3ConfigSource` at the call site.
 */

/** The subset of env vars this resolver reads (raw process.env-shaped). */
export interface S3ConfigSource {
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_BUCKET?: string;
  // Supabase env (session-token mode) — server + public names both accepted.
  SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  POSTGRES_URL?: string;
  SUPABASE_DB_URL?: string;
}

/** The shape `s3Storage({ bucket, config })` consumes. */
export interface ResolvedS3Config {
  bucket: string;
  endpoint?: string;
  region?: string;
  forcePathStyle: true;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
}

const DEFAULT_BUCKET = "cms-media";
/** Region the AWS SDK requires syntactically even when the store ignores it. */
const FALLBACK_REGION = "us-east-1";

const clean = (v?: string): string | undefined => {
  const t = v?.trim();
  return t && t.length > 0 ? t : undefined;
};

/** Extract the Supabase project ref (subdomain) from a Supabase URL. */
export function projectRefFromUrl(url?: string): string | undefined {
  const u = clean(url);
  if (!u) return undefined;
  const m = /^https?:\/\/([a-z0-9]{16,})\.supabase\.(co|in|net)/i.exec(u);
  return m?.[1];
}

/**
 * Derive the AWS region from the Supavisor pooler host in a Postgres URL, e.g.
 * `aws-0-us-east-1.pooler.supabase.com` → `us-east-1`.
 */
export function regionFromPostgresUrl(url?: string): string | undefined {
  const u = clean(url);
  if (!u) return undefined;
  const m = /aws-\d+-([a-z]{2}-[a-z]+-\d+)\.pooler\.supabase\.com/i.exec(u);
  return m?.[1]?.toLowerCase();
}

/** The anon/publishable key, resolving the new Supabase key naming. */
function anonKey(src: S3ConfigSource): string | undefined {
  return (
    clean(src.SUPABASE_ANON_KEY) ??
    clean(src.NEXT_PUBLIC_SUPABASE_ANON_KEY) ??
    clean(src.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  );
}

/**
 * Resolve the full S3 config, or `null` if storage isn't configured by either
 * mode. Callers (the S3 guard + payload.config) use the null to skip work.
 */
export function resolveS3Config(src: S3ConfigSource): ResolvedS3Config | null {
  const bucket = clean(src.S3_BUCKET) ?? DEFAULT_BUCKET;
  const explicitEndpoint = clean(src.S3_ENDPOINT);
  const explicitRegion = clean(src.S3_REGION);

  // Mode 1: dedicated keys.
  const accessKeyId = clean(src.S3_ACCESS_KEY_ID);
  const secretAccessKey = clean(src.S3_SECRET_ACCESS_KEY);
  if (accessKeyId && secretAccessKey) {
    return {
      bucket,
      endpoint: explicitEndpoint,
      region: explicitRegion ?? FALLBACK_REGION,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    };
  }

  // Mode 2: Supabase session-token mode.
  const ref = projectRefFromUrl(
    src.SUPABASE_URL ?? src.NEXT_PUBLIC_SUPABASE_URL,
  );
  const anon = anonKey(src);
  const serviceRole = clean(src.SUPABASE_SERVICE_ROLE_KEY);
  if (ref && anon && serviceRole) {
    return {
      bucket,
      // Derive both — see the InvalidAccessKeyId note above. Explicit wins.
      endpoint:
        explicitEndpoint ?? `https://${ref}.storage.supabase.co/storage/v1/s3`,
      region:
        explicitRegion ??
        regionFromPostgresUrl(src.POSTGRES_URL ?? src.SUPABASE_DB_URL) ??
        FALLBACK_REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: ref,
        secretAccessKey: anon,
        sessionToken: serviceRole,
      },
    };
  }

  return null;
}

/**
 * Is S3 storage configured (by either mode)? Used as the FIRST guard in image
 * generation: if storage is unconfigured the upload throws a cryptic AWS error
 * only AFTER the gateway already billed for each image, so we short-circuit
 * with one actionable log line and waste zero gateway spend.
 */
export function isS3Configured(
  // Reads raw process.env by design (this file spans server + public Supabase
  // vars not all present in the validated ~/env; see the file header).
  // eslint-disable-next-line no-restricted-properties
  src: S3ConfigSource = process.env as S3ConfigSource,
): boolean {
  return resolveS3Config(src) !== null;
}
