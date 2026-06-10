import type { CollectionBeforeValidateHook, CollectionSlug } from "payload";
import { APIError } from "payload";

/**
 * Comment gate: a comment may only be created when its target document has
 * `commentsEnabled: true` (the per-document admin toggle every commentable
 * collection carries — see fields/comments-enabled.ts).
 */
export const requireCommentsEnabled: CollectionBeforeValidateHook = async ({
  data,
  operation,
  req,
}) => {
  if (operation !== "create") return data;
  const target = data?.target as
    | { relationTo?: CollectionSlug; value?: unknown }
    | undefined;
  const targetId =
    typeof target?.value === "object" && target.value !== null
      ? (target.value as { id?: unknown }).id
      : target?.value;
  if (!target?.relationTo || targetId == null) {
    throw new APIError("A comment requires a target document.", 400);
  }

  const doc = (await req.payload
    .findByID({
      collection: target.relationTo,
      id: targetId as string | number,
      depth: 0,
      overrideAccess: true,
      req,
    })
    .catch(() => null)) as { commentsEnabled?: boolean | null } | null;
  if (!doc) throw new APIError("Comment target not found.", 404);
  if (doc.commentsEnabled !== true) {
    throw new APIError("Comments are disabled on this item.", 403);
  }
  return data;
};
