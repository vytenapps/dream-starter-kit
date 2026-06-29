/**
 * Public Supabase Storage URLs for the CMS media bucket.
 *
 * The `cms-media` bucket is PUBLIC-read by design (published content is served
 * on public pages + mobile — see supabase/migrations/…_add_cms_media_bucket.sql).
 * By default the S3 storage plugin keeps Payload access-control ON, so every
 * `<img>` resolves to a relative `/cms-api/media/file/<filename>` URL that boots
 * Payload and opens a Postgres connection PER IMAGE REQUEST. A public page with
 * many images × concurrent visitors can saturate Supabase's connection pooler
 * ("EMAXCONN max client connections reached, limit: 200") and 500 every request.
 *
 * Serving the public object URL directly (`disablePayloadAccessControl: true`
 * + this generator, wired in payload.config.ts) routes images straight to
 * Supabase's storage CDN — zero Payload, zero DB. This is the intended pattern
 * for a public bucket.
 *
 * The public object URL is always derived from the Supabase project URL
 * (`${SUPABASE_URL}/storage/v1/object/public/<bucket>/<key>`), independent of
 * whichever S3 endpoint/credential mode the upload path uses. Read from raw
 * `process.env` (not the validated `~/env`) because payload.config — which
 * imports this — is loaded by the Payload CLI without full env validation.
 */

const SUPABASE_URL =
  // eslint-disable-next-line no-restricted-properties
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
// eslint-disable-next-line no-restricted-properties
const BUCKET = process.env.S3_BUCKET ?? "cms-media";

/**
 * Base URL for public objects in the CMS media bucket, or `null` when the
 * Supabase URL isn't configured (then callers leave Payload's default serving
 * in place).
 */
export function publicMediaBase(): string | null {
  const base = SUPABASE_URL?.replace(/\/+$/, "");
  return base ? `${base}/storage/v1/object/public/${BUCKET}` : null;
}

/** Encode a storage key path-segment-wise (preserve the `/` between segments). */
function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

/**
 * Storage-plugin `generateFileURL`: emit the public Supabase object URL instead
 * of the access-controlled `/cms-api/.../file/<filename>` path. The collection
 * prefix (photos/audio) is already folded into the doc's `prefix` field, so the
 * object key is `prefix ? `${prefix}/${filename}` : filename` (matches
 * getFileKey's non-composite `docPrefix || collectionPrefix` behaviour).
 *
 * Falls back to the relative cms-api URL when the Supabase URL is unset, so an
 * unconfigured/local-only setup keeps working.
 */
export const generateMediaFileURL = ({
  filename,
  prefix,
}: {
  filename: string;
  prefix?: string;
}): string => {
  const base = publicMediaBase();
  const key = prefix ? `${prefix.replace(/\/+$/, "")}/${filename}` : filename;
  if (!base) return `/cms-api/media/file/${encodeKey(key)}`;
  return `${base}/${encodeKey(key)}`;
};

const CMS_FILE_RE = /^\/cms-api\/[^/]+\/file\/([^?#]+)/;

/**
 * Rewrite a STORED (possibly stale) `/cms-api/<collection>/file/<filename>` URL
 * to the public Supabase object URL. Useful for deployments that already cached
 * `<field>Url` columns before this fix, or for read paths that bypass the
 * storage plugin's afterRead hook (e.g. a `depth:0` read or a raw SQL query).
 * Already-absolute or unrecognised URLs pass through unchanged.
 */
export function toPublicMediaUrl(
  url: string | null | undefined,
): string | undefined {
  if (!url) return undefined;
  const match = CMS_FILE_RE.exec(url);
  if (!match) return url;
  const base = publicMediaBase();
  if (!base) return url;
  return `${base}/${match[1]}`;
}
