import type {
  CollectionBeforeValidateHook,
  CollectionSlug,
  Where,
} from "payload";
import { APIError } from "payload";

const idOf = (v: unknown): unknown =>
  typeof v === "object" && v !== null ? (v as { id?: unknown }).id : v;

/**
 * Enforce one row per owner + polymorphic `target` (favorites, reports).
 *
 * A DB-level compound unique index can't express this: polymorphic
 * relationships live in the collection's `_rels` table, which the `indexes`
 * config cannot reach — so uniqueness is checked here. The small race window
 * is acceptable at kit scale (worst case: a duplicate favorite).
 */
export const uniquePolymorphic = ({
  collection,
  ownerField,
  message,
  where,
}: {
  /** The collection this hook is attached to. */
  collection: CollectionSlug;
  /** The owning relationship field (e.g. `user`, `reporter`). */
  ownerField: string;
  message: string;
  /** Extra constraint, e.g. only-open reports count as duplicates. */
  where?: Where;
}): CollectionBeforeValidateHook => {
  return async ({ data, operation, originalDoc, req }) => {
    if (operation !== "create") return data;
    const row = (data ?? {}) as Record<string, unknown>;
    const orig = (originalDoc ?? {}) as Record<string, unknown>;
    const ownerId = idOf(row[ownerField] ?? orig[ownerField]);
    const target = (row.target ?? orig.target) as
      | { relationTo?: string; value?: unknown }
      | undefined;
    const targetValue = idOf(target?.value);
    if (ownerId == null || !target?.relationTo || targetValue == null) {
      return data;
    }

    const and: Where[] = [
      { [ownerField]: { equals: ownerId } },
      {
        "target.relationTo": { equals: target.relationTo },
        "target.value": { equals: targetValue },
      },
    ];
    if (where) and.push(where);

    const existing = await req.payload.find({
      collection,
      where: { and },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    });
    if (existing.totalDocs > 0) throw new APIError(message, 400);
    return data;
  };
};
