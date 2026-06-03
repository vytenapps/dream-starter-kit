import type { Access } from "payload";

/** A signed-in Payload admin user (the `users` collection), of any role. */
export const isAdmin: Access = ({ req }) => Boolean(req.user);

/** Anyone, authenticated or not — used for public assets (e.g. media). */
export const anyone: Access = () => true;

/**
 * Public read of PUBLISHED docs only; admins see everything (incl. drafts).
 * Returns a query constraint for anonymous callers, which Payload ANDs into the
 * find — the database-level equivalent of "published or you're staff". Requires
 * the collection to have `versions: { drafts: true }` (adds `_status`).
 */
export const publishedOrAdmin: Access = ({ req }) => {
  if (req.user) return true;
  return {
    _status: { equals: "published" },
  };
};
