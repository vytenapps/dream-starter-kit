import type {
  CollectionSlug,
  PayloadRequest,
  SanitizedConfig,
  Where,
} from "payload";
import { createPayloadRequest, headersWithCors } from "payload";

/**
 * Resilient CMS bulk delete.
 *
 * Payload's built-in bulk delete (`DELETE /cms-api/<collection>?where=…`, the
 * admin "select rows → Delete" action) runs every matched document's deletion
 * inside ONE shared Postgres transaction. If a single row can't be deleted —
 * a foreign-key reference (e.g. a taxonomy term still used by content), a
 * throwing `beforeDelete` hook, a lock — that error aborts the whole
 * transaction, so EVERY other delete in the batch then fails with "current
 * transaction is aborted". The admin reports "Unable to delete N out of N" with
 * a generic "Something went wrong" per row, and nothing is removed — even the
 * rows that were perfectly deletable. (Payload's per-document `try/catch`
 * records the failures but never rolls the poisoned transaction back, so the
 * cascade is unavoidable; see `payload`'s `collections/operations/delete`.)
 *
 * The fix runs the bulk delete WITHOUT a wrapping transaction
 * (`disableTransaction: true`), so each document is deleted in its own
 * autocommit. One blocked row no longer poisons the rest: the deletable
 * documents are removed and only the genuinely-blocked ones report an error.
 *
 * Scope is deliberately narrow:
 *   - only the collection BULK delete (`DELETE /cms-api/<collection>` with a
 *     `where`) is intercepted; single-document deletes
 *     (`DELETE /cms-api/<collection>/<id>`) and every other route fall through
 *     to Payload's stock handler untouched;
 *   - global transactions stay ON for all other writes (create/update keep
 *     their atomicity — and Payload's migration runner still wraps each
 *     migration in a transaction);
 *   - access control is unchanged: the request is authenticated through the
 *     normal Supabase→Payload bridge and the delete runs with
 *     `overrideAccess: false`, exactly like the built-in handler.
 *
 * If anything unexpected happens before a row is touched (not a collection,
 * missing `where`, access denied), we defer to Payload's stock handler so its
 * status codes and error shape are preserved.
 */

/** Next.js route handler signature for the `[...slug]` catch-all. */
type SlugRouteHandler = (
  request: Request,
  context: { params: Promise<{ slug?: string[] }> },
) => Promise<Response>;

/** `{ docs, errors }` is all this layer needs from the delete operation. */
interface BulkDeleteResult {
  docs: { id: number | string }[];
  errors: { id: number | string; isPublic?: boolean; message: string }[];
}

/** Payload's `StaticLabel`: a plain string or a per-locale map. */
type StaticLabel = string | Record<string, string>;

/**
 * A bulk collection delete is the catch-all hitting exactly one segment (the
 * collection slug, no id) with a `where` query. Anything else — a by-id delete,
 * an auth/custom endpoint, a delete with no `where` — is left to Payload.
 */
export function isBulkCollectionDelete(
  slug: string[] | undefined,
  searchParams: URLSearchParams,
): slug is [string] {
  if (slug?.length !== 1) return false;
  for (const key of searchParams.keys()) {
    if (key === "where" || key.startsWith("where[")) return true;
  }
  return false;
}

/** Resolve a Payload label for the request's language (mirrors getTranslation). */
function resolveLabel(
  label: StaticLabel | undefined,
  language: string,
): string {
  if (typeof label === "string") return label;
  if (label && typeof label === "object") {
    return label[language] ?? Object.values(label)[0] ?? "";
  }
  return "";
}

/**
 * Builds the same JSON body + HTTP status Payload's stock delete endpoint
 * returns: 200 with a "deleted N" message when nothing failed, otherwise 400
 * with "Unable to delete N out of total" and non-public error messages masked
 * to "Something went wrong." (matching `collections/endpoints/delete`).
 */
export function formatBulkDeleteResponse(
  result: BulkDeleteResult,
  ctx: {
    t: PayloadRequest["t"];
    language: string;
    labels: { singular: StaticLabel; plural: StaticLabel };
    headers: Headers;
  },
): Response {
  const { t, language, labels, headers } = ctx;

  if (result.errors.length === 0) {
    const message = t("general:deletedCountSuccessfully", {
      count: result.docs.length,
      label: resolveLabel(
        result.docs.length === 1 ? labels.singular : labels.plural,
        language,
      ),
    });
    return Response.json({ ...result, message }, { headers, status: 200 });
  }

  const errors = result.errors.map((error) =>
    error.isPublic ? error : { ...error, message: "Something went wrong." },
  );
  const total = result.docs.length + errors.length;
  const message = t("error:unableToDeleteCount", {
    count: errors.length,
    label: resolveLabel(
      total === 1 ? labels.singular : labels.plural,
      language,
    ),
    total,
  });
  return Response.json(
    { ...result, errors, message },
    { headers, status: 400 },
  );
}

/**
 * Wraps Payload's generated `DELETE` handler. Bulk collection deletes run
 * transaction-free (resilient); everything else delegates to `fallback`.
 */
export function resilientCmsDelete(
  config: Promise<SanitizedConfig> | SanitizedConfig,
  fallback: SlugRouteHandler,
): SlugRouteHandler {
  return async (request, context) => {
    const params = await context.params;
    const url = new URL(request.url);

    if (!isBulkCollectionDelete(params.slug, url.searchParams)) {
      return fallback(request, context);
    }
    const collectionSlug = params.slug[0];

    let req: PayloadRequest;
    try {
      req = await createPayloadRequest({
        canSetHeaders: true,
        config,
        params: { collection: collectionSlug },
        request,
      });
    } catch {
      // Couldn't even build the request (e.g. CMS not yet provisioned) — let
      // Payload's handler produce its standard response.
      return fallback(request, context);
    }

    const { payload } = req;
    const collection = payload.collections[collectionSlug as CollectionSlug] as
      | (typeof payload.collections)[CollectionSlug]
      | undefined;
    const where = (req.query as { where?: Where }).where;
    // Not a real collection, or no `where`: Payload's handler owns the response
    // (a 404, or its "Missing 'where' query" 400). Nothing was deleted yet, so
    // delegating is safe.
    if (!collection || !where) {
      return fallback(request, context);
    }

    const query = req.query as {
      depth?: string | number;
      trash?: string | boolean;
      overrideLock?: string | boolean;
    };

    let result: BulkDeleteResult;
    try {
      result = (await payload.delete({
        collection: collectionSlug as CollectionSlug,
        where,
        depth: query.depth != null ? Number(query.depth) : undefined,
        trash: query.trash === true || query.trash === "true",
        overrideLock:
          query.overrideLock === true || query.overrideLock === "true",
        req,
        user: req.user,
        overrideAccess: false,
        // The fix: no wrapping transaction, so one blocked row can't abort the
        // others (see file header).
        disableTransaction: true,
      })) as unknown as BulkDeleteResult;
    } catch {
      // Threw before deleting anything (most likely access denied) — defer to
      // Payload so the access error is formatted exactly as usual.
      return fallback(request, context);
    }

    return formatBulkDeleteResponse(result, {
      t: req.t,
      language: req.i18n.language,
      labels: collection.config.labels as {
        singular: StaticLabel;
        plural: StaticLabel;
      },
      headers: headersWithCors({ headers: new Headers(), req }),
    });
  };
}
