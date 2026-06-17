import type { CollectionConfig, GlobalConfig } from "payload";

/**
 * Disable Payload's document-locking ("another user is editing this document")
 * for a collection or global.
 *
 * Why the kit turns this off everywhere: on every `overrideLock: false`
 * save/delete, Payload core's `checkDocumentLockStatus` issues a **req-less**
 * `payload.db.find` against `payload-locked-documents` — a query that runs
 * OUTSIDE the operation's transaction and therefore checks out a SECOND pool
 * connection (the exact footgun the `db.pool` note in `payload.config.ts`
 * warns about: "always pass `req` to nested Local API calls"). On the kit's
 * deliberately small serverless pool (`max: 2`) that extra connection starves
 * under the admin's concurrent requests, so the save waits out
 * `connectionTimeoutMillis` and 500s ("cannot begin transaction" / "Failed
 * query: … payload_locked_documents …").
 *
 * Document locking is a collaborative-editing nicety, not core to the kit, so
 * disabling it CMS-wide keeps every save/delete single-connection. Map it over
 * the `collections` and `globals` arrays in `payload.config.ts` so it also
 * covers extensions' collections/globals.
 */
export function noDocumentLock<T extends CollectionConfig | GlobalConfig>(
  entity: T,
): T {
  return { ...entity, lockDocuments: false };
}
