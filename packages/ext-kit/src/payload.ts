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

/**
 * Editorial content: staff see drafts + published; everyone else (incl.
 * anonymous) sees only published rows. Mirrors the host's `publishedOrStaff`
 * so content-bearing extensions (e.g. ext-docs) can gate public read.
 */
export const publishedOrStaff: Access = ({ req }) => {
  if (roles(req).some((r) => STAFF_ROLES.includes(r))) return true;
  return { _status: { equals: "published" } };
};

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
  /**
   * Admin nav group for the settings screen. Defaults to "Extensions"; a
   * feature with several admin entries (e.g. AI Chat: settings + skills +
   * adapter tabs) can cluster them under its own group.
   */
  group?: string;
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
    // `tabs` fields nest their fields under tabs[].fields; unnamed tabs hoist
    // those to the document root, so their defaults belong at the top level.
    if ("type" in field && field.type === "tabs" && Array.isArray(field.tabs)) {
      for (const tab of field.tabs) {
        if (Array.isArray(tab.fields) && !("name" in tab)) {
          Object.assign(defaults, collectDefaults(tab.fields));
        }
      }
      continue;
    }
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
      admin: { group: opts.group ?? "Extensions" },
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

/* -------------------------------------------------------------------------- */
/* Settings-tab contributions — adapters that plug into a host feature's       */
/* settings screen instead of owning a separate one (e.g. chat channel         */
/* adapters → the one "AI Chat Settings" global).                              */
/* -------------------------------------------------------------------------- */

/** A tab injected into a target settings global (structurally a Payload Tab). */
interface SettingsTab {
  label: string;
  description?: string;
  fields: Field[];
}

export interface AdapterSettingsOptions {
  /** The contributing extension's slug, e.g. "chat-adapter-slack". */
  slug: string;
  /** Tab label, e.g. "Slack". */
  name: string;
  /** The host extension slug whose settings global hosts this tab, e.g. "chat". */
  target: string;
  /** Optional tab blurb. */
  description?: string;
  /** The author-controlled fields (stored under a per-adapter group). */
  fields: Field[];
}

export interface AdapterSettings {
  slug: string;
  /** Host extension slug whose `ext-<target>-settings` global owns the tab. */
  target: string;
  /** Group key namespacing this adapter's fields inside the target global. */
  groupName: string;
  /** Field defaults (un-nested), applied by `getAdapterSettings`. */
  defaults: Record<string, unknown>;
  /** The tab merged into the target settings global by `composeSettingsTabs`. */
  tab: SettingsTab;
}

/** `chat-adapter-slack` → `adapter_chat_adapter_slack` (a valid field/group name). */
export function adapterGroupName(slug: string): string {
  return `adapter_${slug.replace(/-/g, "_")}`;
}

/**
 * Define an adapter's settings as a TAB contributed to another extension's
 * settings global, rather than a standalone global. The fields live under a
 * per-adapter `group` so multiple adapters never collide, and the host's
 * generated payload registry merges the tab in via `composeSettingsTabs`. The
 * adapter reads its values back with `getAdapterSettings`. Keeps adapters
 * modular (own extension, own webhook) while presenting one unified screen.
 */
export function defineAdapterSettings(
  opts: AdapterSettingsOptions,
): AdapterSettings {
  const groupName = adapterGroupName(opts.slug);
  return {
    slug: opts.slug,
    target: opts.target,
    groupName,
    defaults: collectDefaults(opts.fields),
    tab: {
      label: opts.name,
      ...(opts.description ? { description: opts.description } : {}),
      // One group wraps the adapter's fields so the target global stores them
      // under `groupName` — no field-name collisions across adapters.
      fields: [
        {
          name: groupName,
          type: "group",
          label: opts.name,
          fields: opts.fields,
        },
      ],
    },
  };
}

/**
 * Merge adapter tabs into a host feature's settings global. Called by the
 * generated payload registry (`pnpm ext sync`) so the host composes — the
 * feature extension never imports its sibling adapters. The base settings'
 * first `tabs` field gains one tab per adapter, and the document defaults gain
 * each adapter's namespaced group.
 */
export function composeSettingsTabs(
  base: ExtensionSettings,
  adapters: AdapterSettings[],
): ExtensionSettings {
  if (adapters.length === 0) return base;
  const fields = base.global.fields.map((field) => {
    if ("type" in field && field.type === "tabs" && Array.isArray(field.tabs)) {
      return { ...field, tabs: [...field.tabs, ...adapters.map((a) => a.tab)] };
    }
    return field;
  });
  const defaults = { ...base.defaults };
  for (const a of adapters) defaults[a.groupName] = a.defaults;
  return {
    ...base,
    defaults,
    global: { ...base.global, fields },
  };
}

/**
 * Read an adapter's settings server-side, from its tab inside the target
 * settings global (`ext-<target>-settings`), with defaults applied. Mirrors
 * `getExtensionSettings` but reads the namespaced group.
 */
export async function getAdapterSettings<
  T extends Record<string, unknown> = Record<string, unknown>,
>(payload: Payload, adapter: AdapterSettings): Promise<T> {
  try {
    const findGlobal = payload.findGlobal.bind(payload) as (args: {
      slug: string;
    }) => Promise<Record<string, unknown>>;
    const doc = await findGlobal({ slug: settingsGlobalSlug(adapter.target) });
    const group = (doc[adapter.groupName] ?? {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...adapter.defaults };
    for (const [key, value] of Object.entries(group)) {
      if (value !== null && value !== undefined) merged[key] = value;
    }
    return merged as T;
  } catch {
    return adapter.defaults as T;
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
