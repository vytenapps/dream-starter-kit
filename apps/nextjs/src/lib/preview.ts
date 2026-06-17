/**
 * Draft-preview helpers shared by the Payload admin (Live Preview / preview
 * button) and the `/next/preview` entry route.
 *
 * The admin generates a preview URL pointing at `/next/preview`, which validates
 * the secret, enables Next.js draft mode, and redirects to the document's public
 * path — where `getPage` then serves the draft (see `lib/payload.ts`).
 */
import { env } from "../env";

/**
 * Device breakpoints offered in the admin Live Preview toolbar (the
 * mobile/tablet/desktop frame switcher). Shared by every collection that
 * enables `admin.livePreview`.
 */
export const previewBreakpoints = [
  { label: "Mobile", name: "mobile", width: 375, height: 667 },
  { label: "Tablet", name: "tablet", width: 768, height: 1024 },
  { label: "Desktop", name: "desktop", width: 1440, height: 900 },
];

/** The public front-end path for a CMS document. */
export function docPath(collection: string, slug?: string | null): string {
  if (collection === "pages") {
    return !slug || slug === "home" ? "/" : `/${slug}`;
  }
  return slug ? `/${collection}/${slug}` : `/${collection}`;
}

/**
 * Build the `/next/preview` URL for a document — used as Payload's
 * `admin.livePreview.url` and `admin.preview`. Includes the target path and
 * (when configured) the shared preview secret.
 */
export function generatePreviewPath({
  collection,
  slug,
}: {
  collection: string;
  slug?: string | null;
}): string {
  const params = new URLSearchParams({
    path: docPath(collection, slug),
    collection,
    slug: slug ?? "",
  });
  const secret = env.PAYLOAD_PREVIEW_SECRET;
  if (secret) params.set("secret", secret);
  return `/next/preview?${params.toString()}`;
}
