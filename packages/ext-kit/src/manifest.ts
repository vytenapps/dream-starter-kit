import { z } from "zod/v4";

/**
 * Extension manifest — the typed contract between an extension and the host
 * (see docs/EXTENSIONS-PLAN.md §1.4). The manifest is consumed ONLY by codegen
 * (`pnpm ext sync` loads `extensions/<slug>/extension.config.ts` at sync time);
 * client bundles never import it — sync bakes nav/routes/widgets into the
 * generated registries as literals.
 */

/** Extension slug rule: 2–31 chars, lowercase, starts with a letter. */
export const SLUG_RE = /^[a-z][a-z0-9-]{1,30}$/;

/** Plain semver version (manifest version = git tag = package.json version). */
export const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

const navEntrySchema = z.object({
  title: z.string().min(1),
  href: z.string().startsWith("/"),
  /** Icon name resolved through the generated icon map (graceful fallback). */
  icon: z.string().min(1).optional(),
  /** Menu sort order — lower first. Core entries use 10, 20, 30, … */
  order: z.number().int().default(100),
});

const routeEntrySchema = z.object({
  /** Route path relative to the mount, Expo/Next dynamic-segment syntax. "" = index. */
  path: z.string(),
  /** Named export from the `./web` (or `./native`) entry to mount. */
  component: z.string().min(1),
  /** Web layout group for the generated stub: authed shell (default) or public. */
  area: z.enum(["app", "public"]).default("app"),
  /**
   * Absolute mount override instead of /x/<slug>/<path> (e.g. billing claims
   * "/billing", dashboard claims "/a"). Validated against the reserved core
   * list and cross-extension collisions. On native, "index" mounts the home
   * screen.
   */
  mount: z.string().optional(),
});

export const extensionManifestSchema = z.object({
  slug: z.string().regex(SLUG_RE, "slug must match ^[a-z][a-z0-9-]{1,30}$"),
  name: z.string().min(1),
  version: z.string().regex(SEMVER_RE, "version must be plain semver"),
  /** Semver range of kit versions this extension supports (e.g. ">=1.0.0 <2"). */
  kitCompat: z.string().min(1),
  description: z.string().optional(),
  /** Slugs of extensions this one depends on (service imports + DML access). */
  requires: z.array(z.string().regex(SLUG_RE)).default([]),
  platforms: z
    .object({
      web: z.boolean().default(true),
      native: z.boolean().default(true),
    })
    .prefault({}),
  /** Nav DEFAULTS — seeded into the CMS-driven menu on install, staff-editable after. */
  nav: z
    .object({
      web: z.array(navEntrySchema).default([]),
      native: z.array(navEntrySchema).default([]),
    })
    .prefault({}),
  routes: z
    .object({
      web: z.array(routeEntrySchema).default([]),
      native: z.array(routeEntrySchema).default([]),
    })
    .prefault({}),
  /** Optional dashboard widget — export names from ./web and ./native. */
  widgets: z
    .object({
      web: z.string().min(1).optional(),
      native: z.string().min(1).optional(),
    })
    .prefault({}),
  server: z
    .object({
      /** `./server` exports `routes: ExtRouteTable`, served at /api/ext/<slug>/…. */
      routes: z.boolean().default(false),
      /** Edge function directory names — must be prefixed `<slug>-`. */
      edgeFunctions: z.array(z.string().min(1)).default([]),
    })
    .prefault({}),
  database: z
    .object({
      /** Every public-schema table the extension owns — must be `ext_<slug>_*`. */
      tables: z.array(z.string().min(1)).default([]),
      /**
       * Tables owned elsewhere this extension may DML (never DDL): tables of
       * extensions it `requires` (e.g. reminders → ext_notifications) or the
       * core DML whitelist (e.g. billing → tags/user_tags). Validated by sync.
       */
      dml: z.array(z.string().min(1)).default([]),
    })
    .prefault({}),
  cms: z
    .object({
      /** Payload collection slugs (from ./payload `collections`) — `ext-<slug>-*`. */
      collections: z.array(z.string().min(1)).default([]),
      /** Payload global slugs (from ./payload `globals`) — `ext-<slug>-*`. */
      globals: z.array(z.string().min(1)).default([]),
      hasPlugins: z.boolean().default(false),
      hasMigrations: z.boolean().default(false),
      hasSeed: z.boolean().default(false),
      /** `./payload` exports `settings` (an admin settings screen). */
      hasSettings: z.boolean().default(false),
    })
    .prefault({}),
  env: z
    .object({
      /** `./env` exports a `server` zod shape (vars named EXT_<SLUG>_*). */
      hasServer: z.boolean().default(false),
      /** `./env` exports a `client` zod shape (NEXT_PUBLIC_EXT_* / EXPO_PUBLIC_EXT_*). */
      hasClient: z.boolean().default(false),
    })
    .prefault({}),
});

export type ExtensionManifestInput = z.input<typeof extensionManifestSchema>;
export type ExtensionManifest = z.output<typeof extensionManifestSchema>;
export type ExtNavEntry = ExtensionManifest["nav"]["web"][number];
export type ExtRouteEntry = ExtensionManifest["routes"]["web"][number];

/**
 * Define an extension manifest (the default export of
 * `extensions/<slug>/extension.config.ts`). Parses eagerly so a malformed
 * manifest fails at sync time with a precise zod error.
 */
export function defineExtension(
  manifest: ExtensionManifestInput,
): ExtensionManifest {
  return extensionManifestSchema.parse(manifest);
}
