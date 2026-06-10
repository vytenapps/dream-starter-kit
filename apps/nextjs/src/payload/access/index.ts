import type { Access, FieldAccess, PayloadRequest } from "payload";

/**
 * Role-based access helpers for the `roles: string[]` model on `users`
 * (admin | editor | author | member).
 *
 * Note: the SSO bridge (payload/auth/supabase-strategy.ts) currently
 * authenticates ONLY staff app users (`profiles.is_staff`), so the
 * member-scoped query constraints below (`ownsOrStaff`, `isAdminOrSelf`)
 * are exercised via the Local API today and become live for members when
 * the member API bridge ships (documented follow-up).
 */

const STAFF_ROLES = ["admin", "editor"];
const ADMIN_PANEL_ROLES = ["admin", "editor", "author"];

type ReqUser = PayloadRequest["user"];

const hasRole = (user: ReqUser, roles: string[]): boolean =>
  Boolean(user?.roles.some((r: string) => roles.includes(r)));

/** Anyone, authenticated or not — used for public assets (e.g. media). */
export const anyone: Access = () => true;

/** Full administrators only. */
export const isAdmin: Access = ({ req: { user } }) =>
  Boolean(user?.roles.includes("admin"));

/** Content staff: admin or editor. */
export const isStaff: Access = ({ req: { user } }) =>
  hasRole(user, STAFF_ROLES);

/**
 * Admin-panel gate (`access.admin` on `users`): admin, editor or author may
 * open /admin. Layered on top of the SSO strategy's `profiles.is_staff` gate —
 * both must pass.
 */
export const canAccessAdmin = ({
  req: { user },
}: {
  req: PayloadRequest;
}): boolean => hasRole(user, ADMIN_PANEL_ROLES);

/** Admins see everyone; everyone else only their own `users` row. */
export const isAdminOrSelf: Access = ({ req: { user } }) => {
  if (user?.roles.includes("admin")) return true;
  if (user) return { id: { equals: user.id } };
  return false;
};

/**
 * Owner-scoped rows (favorites, device-tokens, enrollments, …): staff see
 * everything; an authenticated user only rows whose `ownerField` is them.
 */
export const ownsOrStaff =
  (ownerField = "user"): Access =>
  ({ req: { user } }) => {
    if (hasRole(user, STAFF_ROLES)) return true;
    if (user) return { [ownerField]: { equals: user.id } };
    return false;
  };

/**
 * Public read of PUBLISHED docs only; staff see everything (incl. drafts).
 * Returns a query constraint that Payload ANDs into the find. Requires the
 * collection to have `versions: { drafts: true }` (adds `_status`).
 */
export const publishedOrStaff: Access = ({ req: { user } }) => {
  if (hasRole(user, STAFF_ROLES)) return true;
  return { _status: { equals: "published" } };
};

/**
 * Moderated user content (comments, reviews): public reads see `approved`
 * rows only; staff see everything.
 */
export const approvedOrStaff: Access = ({ req: { user } }) => {
  if (hasRole(user, STAFF_ROLES)) return true;
  return { status: { equals: "approved" } };
};

/** Field-level lock: only staff may read/update the field. */
export const staffFieldAccess: FieldAccess = ({ req: { user } }) =>
  hasRole(user, STAFF_ROLES);

/** Field-level lock: only admins may update (e.g. `users.roles`). */
export const adminFieldAccess: FieldAccess = ({ req: { user } }) =>
  Boolean(user?.roles.includes("admin"));
