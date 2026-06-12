import type {
  Access,
  Field,
  FieldAccess,
  GlobalConfig,
  Payload,
} from "payload";

import { settingsGlobalSlug } from "./validate";

/**
 * Payload-side extension helpers: admin settings screens (§1.7), seed steps,
 * and the kit's standard role-based access helpers (mirroring the host's
 * payload/access for the `roles: string[]` model on `users`) so extension
 * collections don't reach into host code. This entry imports `payload` types
 * and is reachable only from the web/server side — never from clients.
 */

const STAFF_ROLES = ["admin", "editor"];

const roles = (req: { user?: unknown }): string[] =>
  (req.user as { roles?: string[] } | null | undefined)?.roles ?? [];

const userId = (req: { user?: unknown }): string | number | undefined =>
  (req.user as { id?: string | number } | null | undefined)?.id ?? undefined;

/** Anyone, authenticated or not. */
export const anyone: Access = () => true;

/** Full administrators only. */
export const isAdmin: Access = ({ req }) => roles(req).includes("admin");

/** Content staff: admin or editor. */
export const isStaff: Access = ({ req }) =>
  roles(req).some((r) => STAFF_ROLES.includes(r));

/** Owner-scoped rows: staff see everything; users only rows whose owner is them. */
export const ownsOrStaff =
  (ownerField = "user"): Access =>
  ({ req }) => {
    if (roles(req).some((r) => STAFF_ROLES.includes(r))) return true;
    const id = userId(req);
    if (id !== undefined) return { [ownerField]: { equals: id } };
    return false;
  };

/** Field-level lock: only staff may read/update the field. */
export const staffFieldAccess: FieldAccess = ({ req }) =>
  roles(req).some((r) => STAFF_ROLES.includes(r));

/** Field-level lock: only admins may update. */
export const adminFieldAccess: FieldAccess = ({ req }) =>
  roles(req).includes("admin");

const staffRead: Access = isStaff;
const adminUpdate: Access = isAdmin;
const anyoneRead: Access = anyone;

export interface ExtensionSettingsOptions {
  /** The extension's slug — the global becomes `ext-<slug>-settings`. */
  slug: string;
  /** The extension's display name — labels the screen "<name> Settings". */
  name: string;
  /** The author-controlled part: the configurable fields. */
  fields: Field[];
  /**
   * Expose the global read-only via /cms-api REST to anonymous clients
   * (for client-consumed config like feature toggles — NEVER secrets;
   * secrets belong in the zod env schema, golden rule #3).
   */
  publicRead?: boolean;
}

export interface ExtensionSettings {
  globalSlug: string;
  /** Whether clients may read this global anonymously over REST. */
  publicRead: boolean;
  /** Field defaults, applied by `getExtensionSettings` before first save. */
  defaults: Record<string, unknown>;
  /** The wrapped Payload Global — registered via the generated payload registry. */
  global: GlobalConfig;
}

/** Collect `defaultValue`s from top-level named fields (incl. inside rows/groups). */
function collectDefaults(fields: Field[]): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const field of fields) {
    if (
      "fields" in field &&
      Array.isArray(field.fields) &&
      !("name" in field)
    ) {
      Object.assign(defaults, collectDefaults(field.fields));
      continue;
    }
    if (
      "name" in field &&
      typeof field.name === "string" &&
      "defaultValue" in field &&
      typeof field.defaultValue !== "function" &&
      field.defaultValue !== undefined
    ) {
      defaults[field.name] = field.defaultValue;
    }
  }
  return defaults;
}

/**
 * Wrap author-defined fields in a framework-invariant Payload Global: slug
 * `ext-<slug>-settings`, Extensions admin group, versioned, staff-read /
 * admin-update by default (or public read when opted in). The extension's
 * `./payload` entry exports the result as `settings`; sync registers
 * `settings.global` like any other global.
 */
export function defineExtensionSettings(
  opts: ExtensionSettingsOptions,
): ExtensionSettings {
  const globalSlug = settingsGlobalSlug(opts.slug);
  return {
    globalSlug,
    publicRead: opts.publicRead ?? false,
    defaults: collectDefaults(opts.fields),
    global: {
      slug: globalSlug,
      label: `${opts.name} Settings`,
      admin: { group: "Extensions" },
      access: {
        read: opts.publicRead ? anyoneRead : staffRead,
        update: adminUpdate,
        readVersions: staffRead,
      },
      versions: true,
      fields: opts.fields,
    },
  };
}

/**
 * Read an extension's settings server-side (Local API), with field defaults
 * applied — so an extension works before the admin ever opens the screen, and
 * degrades to defaults if the CMS is unreachable.
 */
export async function getExtensionSettings<
  T extends Record<string, unknown> = Record<string, unknown>,
>(payload: Payload, settings: ExtensionSettings): Promise<T> {
  try {
    const findGlobal = payload.findGlobal.bind(payload) as (args: {
      slug: string;
    }) => Promise<Record<string, unknown>>;
    const doc = await findGlobal({ slug: settings.globalSlug });
    const merged: Record<string, unknown> = { ...settings.defaults };
    for (const [key, value] of Object.entries(doc)) {
      if (value !== null && value !== undefined) merged[key] = value;
    }
    return merged as T;
  } catch {
    return settings.defaults as T;
  }
}

/**
 * One step of an extension's CMS seed — appended after the core steps and run
 * through the existing idempotent `/api/cms/seed` + `/cms-setup` flow. Steps
 * must be idempotent and scalar-only (no binary fixtures).
 */
export interface ExtSeedStep {
  label: string;
  run: (payload: Payload) => Promise<void>;
}
