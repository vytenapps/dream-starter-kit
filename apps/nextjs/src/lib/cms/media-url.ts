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
 * The upload collections served from the public bucket, mapped to their storage
 * prefix (see payload.config.ts s3Storage). The object key is
 * `prefix ? `${prefix}/${filename}` : filename`. Keep in sync with the config.
 */
const COLLECTION_PREFIXES: Record<string, string> = {
  media: "",
  photos: "photos",
  audio: "audio",
};
const PREFIX_TO_COLLECTION: Record<string, string> = {
  "": "media",
  photos: "photos",
  audio: "audio",
};

/**
 * Hosts whose `/cms-api/<coll>/file/<name>` URLs we may rewrite to the public
 * bucket — this app's own origin(s). Payload builds those absolute URLs from its
 * serverURL (the app host), so a foreign URL that merely *contains* a cms-api
 * path (e.g. one stored in a rich-text link) must be left alone. Relative paths
 * are always ours. Read from raw env (payload.config loads this without ~/env).
 */
function ownHosts(): Set<string> {
  const hosts = new Set<string>();
  for (const raw of [
    // eslint-disable-next-line no-restricted-properties
    process.env.NEXT_PUBLIC_SITE_URL,
    // eslint-disable-next-line no-restricted-properties
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
    // eslint-disable-next-line no-restricted-properties
    process.env.NEXT_PUBLIC_VERCEL_URL,
    // eslint-disable-next-line no-restricted-properties
    process.env.NEXT_PUBLIC_APP_URL,
  ]) {
    if (!raw) continue;
    try {
      hosts.add(
        new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`).host,
      );
    } catch {
      /* ignore malformed */
    }
  }
  return hosts;
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
  const normalizedPrefix = (prefix ?? "").replace(/\/+$/, "");
  const key = normalizedPrefix ? `${normalizedPrefix}/${filename}` : filename;
  if (!base) {
    // No CDN base (Supabase URL unset) — fall back to the access-controlled
    // cms-api route. Its URL is `/cms-api/<collection>/file/<filename>` with the
    // BARE filename (the prefix is a storage-key concern, not part of the URL),
    // and the collection segment must match the prefix's owner.
    const collection = PREFIX_TO_COLLECTION[normalizedPrefix] ?? "media";
    return `/cms-api/${collection}/file/${encodeKey(filename)}`;
  }
  return `${base}/${encodeKey(key)}`;
};

// Capture BOTH the collection segment and the filename: the object key is
// `${prefix}/${filename}` where prefix depends on the collection (photos/audio),
// so dropping the collection would resolve prefixed uploads to a WRONG key.
const CMS_FILE_RE = /\/cms-api\/([^/]+)\/file\/([^?#]+)/;

/**
 * Rewrite a STORED (possibly stale) `…/cms-api/<collection>/file/<filename>` URL
 * (relative or absolute) to the public Supabase object URL. Useful for
 * deployments that already cached `<field>Url` columns before this fix, or for
 * read paths that bypass the storage plugin's afterRead hook (e.g. a `depth:0`
 * read or a raw SQL query).
 *
 * Only rewrites OUR cms-api file URLs for the public-bucket collections
 * (media/photos/audio): relative paths, or absolute URLs on this app's own host.
 * Anything else (foreign host, non-file path, unknown collection) passes through
 * unchanged, so an external URL that merely contains a cms-api-like path is never
 * mangled onto our bucket.
 */
export function toPublicMediaUrl(
  url: string | null | undefined,
): string | undefined {
  if (!url) return undefined;
  // Absolute URLs are only ours if the host matches this app's origin.
  if (/^https?:\/\//i.test(url)) {
    let host: string;
    try {
      host = new URL(url).host;
    } catch {
      return url;
    }
    if (!ownHosts().has(host)) return url;
  }
  const match = CMS_FILE_RE.exec(url);
  if (!match) return url;
  const [, collection, filename] = match;
  // Only the public-bucket upload collections are served from the CDN.
  const prefix = COLLECTION_PREFIXES[collection ?? ""];
  if (prefix === undefined) return url;
  const base = publicMediaBase();
  if (!base) return url;
  const key = prefix ? `${prefix}/${filename}` : filename;
  return `${base}/${key}`;
}
