import type { CollectionBeforeChangeHook } from "payload";

/**
 * Force the owner field (user/author/reporter) to the requesting user on
 * create. Payload `create` access can't express query constraints (a returned
 * Where is just truthy), so without this a member could create owner-scoped
 * rows for someone else. Staff and Local API writes (no req.user, e.g. the
 * webhook/seed) may set the owner explicitly.
 */
export const assignOwner =
  (ownerField = "user"): CollectionBeforeChangeHook =>
  ({ data, operation, req }) => {
    if (operation !== "create" || !req.user) return data;
    const isStaff = req.user.roles.some((r) => ["admin", "editor"].includes(r));
    if (isStaff && data[ownerField] != null) return data;
    return { ...data, [ownerField]: req.user.id };
  };
