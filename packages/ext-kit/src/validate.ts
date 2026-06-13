import type { ExtensionManifest } from "./manifest";

/**
 * Pure validation logic for extension manifests — namespacing, mount
 * collisions, SQL ownership lint (docs/EXTENSIONS-PLAN.md §1.1). Consumed by
 * `pnpm ext sync` (tooling/ext) and unit-tested here. Every function returns
 * human-readable error strings instead of throwing so the CLI can aggregate.
 */

/** `chat-plus` → `chat_plus` (table-name form of a slug). */
export function slugToSnake(slug: string): string {
  return slug.replace(/-/g, "_");
}

/** The required prefix for an extension's public-schema tables. */
export function tablePrefix(slug: string): string {
  return `ext_${slugToSnake(slug)}`;
}

/** The required prefix for an extension's Payload collection/global slugs. */
export function cmsPrefix(slug: string): string {
  return `ext-${slug}`;
}

/** The implicit settings-global slug for an extension (§1.7). */
export function settingsGlobalSlug(slug: string): string {
  return `ext-${slug}-settings`;
}

/** The required env-var prefix family for an extension. */
export function envPrefixes(slug: string): string[] {
  const upper = slugToSnake(slug).toUpperCase();
  return [
    `EXT_${upper}_`,
    `NEXT_PUBLIC_EXT_${upper}_`,
    `EXPO_PUBLIC_EXT_${upper}_`,
  ];
}

/**
 * Core route prefixes a `mount` override may never claim — all host-owned.
 * The extension default-mount namespace is /a/<slug>: overrides may not claim
 * inside it (checked separately), but the bare "/a" mount itself IS claimable
 * (the dashboard claims it as the app home).
 */
export const RESERVED_MOUNTS = [
  "/admin",
  "/cms-api",
  "/api",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/accept-invite",
  "/confirm-email",
  "/check-email",
  "/welcome",
  "/cms-setup",
  "/profile",
  "/checkout",
] as const;

/** Native mounts are screen names, not paths; only the home screen is claimable. */
export const NATIVE_MOUNTS = ["index"] as const;

/**
 * Core `public` tables extensions may declare DML access to (`database.dml`).
 * Kept deliberately tiny — e.g. billing's webhook auto-tags users by plan.
 */
export const CORE_DML_WHITELIST = ["tags", "user_tags"] as const;

function startsWithPrefix(name: string, prefix: string): boolean {
  return name === prefix || name.startsWith(`${prefix}_`);
}

/** Per-manifest semantic checks (beyond the zod shape). */
export function validateManifest(m: ExtensionManifest): string[] {
  const errors: string[] = [];
  const prefix = tablePrefix(m.slug);
  const cms = cmsPrefix(m.slug);

  for (const table of m.database.tables) {
    if (!startsWithPrefix(table, prefix)) {
      errors.push(
        `[${m.slug}] table "${table}" must be "${prefix}" or "${prefix}_*"`,
      );
    }
  }
  for (const slug of [...m.cms.collections, ...m.cms.globals]) {
    if (slug !== cms && !slug.startsWith(`${cms}-`)) {
      errors.push(
        `[${m.slug}] cms slug "${slug}" must be "${cms}" or "${cms}-*"`,
      );
    }
  }
  if (m.cms.globals.includes(settingsGlobalSlug(m.slug)) && m.cms.hasSettings) {
    errors.push(
      `[${m.slug}] "${settingsGlobalSlug(m.slug)}" is implicit via cms.hasSettings — don't also list it in cms.globals`,
    );
  }
  for (const fn of m.server.edgeFunctions) {
    if (!fn.startsWith(`${m.slug}-`)) {
      errors.push(
        `[${m.slug}] edge function "${fn}" must be prefixed "${m.slug}-"`,
      );
    }
  }
  if (m.requires.includes(m.slug)) {
    errors.push(`[${m.slug}] cannot require itself`);
  }

  // Platform consistency: declaring native surface requires the native platform.
  if (!m.platforms.native) {
    if (m.nav.native.length > 0 || m.routes.native.length > 0)
      errors.push(
        `[${m.slug}] declares native nav/routes but platforms.native is false`,
      );
    if (m.widgets.native)
      errors.push(
        `[${m.slug}] declares a native widget but platforms.native is false`,
      );
  }
  if (!m.platforms.web) {
    if (m.nav.web.length > 0 || m.routes.web.length > 0)
      errors.push(
        `[${m.slug}] declares web nav/routes but platforms.web is false`,
      );
    if (m.widgets.web)
      errors.push(
        `[${m.slug}] declares a web widget but platforms.web is false`,
      );
  }

  // Mount overrides: web mounts are absolute paths outside the reserved list;
  // native mounts come from the short NATIVE_MOUNTS list.
  for (const r of m.routes.web) {
    if (r.mount === undefined) continue;
    if (!r.mount.startsWith("/")) {
      errors.push(`[${m.slug}] web mount "${r.mount}" must start with "/"`);
      continue;
    }
    const claimed = RESERVED_MOUNTS.find(
      (res) => r.mount === res || r.mount?.startsWith(`${res}/`),
    );
    if (claimed) {
      errors.push(
        `[${m.slug}] web mount "${r.mount}" collides with reserved core route "${claimed}"`,
      );
    }
    // "/a" exactly is claimable (the dashboard home), but "/a/<seg>" is the
    // default-mount namespace (/a/<slug>) — overrides inside it would collide
    // with generated mounts.
    if (r.mount.startsWith("/a/")) {
      errors.push(
        `[${m.slug}] web mount "${r.mount}" is inside the extension default-mount namespace /a/<slug> — drop the mount override or claim a path outside /a/`,
      );
    }
  }
  for (const r of m.routes.native) {
    if (r.mount === undefined) continue;
    if (!NATIVE_MOUNTS.includes(r.mount as (typeof NATIVE_MOUNTS)[number])) {
      errors.push(
        `[${m.slug}] native mount "${r.mount}" — only ${NATIVE_MOUNTS.join(", ")} can be claimed`,
      );
    }
  }

  return errors;
}

/** Cross-extension collision + dependency checks for the installed set. */
export function validateManifestSet(manifests: ExtensionManifest[]): string[] {
  const errors: string[] = [];
  const slugs = new Set<string>();

  const claim = (
    kind: string,
    key: string,
    owner: string,
    seen: Map<string, string>,
  ) => {
    const prior = seen.get(key);
    if (prior && prior !== owner) {
      errors.push(`${kind} "${key}" claimed by both "${prior}" and "${owner}"`);
    } else {
      seen.set(key, owner);
    }
  };

  const tables = new Map<string, string>();
  const cmsSlugs = new Map<string, string>();
  const webMounts = new Map<string, string>();
  const nativeMounts = new Map<string, string>();
  const edgeFns = new Map<string, string>();

  for (const m of manifests) {
    if (slugs.has(m.slug)) {
      errors.push(`duplicate extension slug "${m.slug}"`);
      continue;
    }
    slugs.add(m.slug);

    for (const t of m.database.tables) claim("table", t, m.slug, tables);
    for (const c of [
      ...m.cms.collections,
      ...m.cms.globals,
      ...(m.cms.hasSettings ? [settingsGlobalSlug(m.slug)] : []),
    ])
      claim("cms slug", c, m.slug, cmsSlugs);
    for (const r of m.routes.web)
      if (r.mount) claim("web mount", r.mount, m.slug, webMounts);
    for (const r of m.routes.native)
      if (r.mount) claim("native mount", r.mount, m.slug, nativeMounts);
    for (const fn of m.server.edgeFunctions)
      claim("edge function", fn, m.slug, edgeFns);
  }

  for (const m of manifests) {
    for (const dep of m.requires) {
      if (!slugs.has(dep)) {
        errors.push(
          `[${m.slug}] requires "${dep}", which is not installed — install it first`,
        );
      }
    }

    // database.dml entries must be reachable: a table of a required extension
    // or a core-whitelisted table — never an arbitrary table.
    const reachable = new Set<string>(CORE_DML_WHITELIST);
    for (const dep of manifests.filter((x) => m.requires.includes(x.slug))) {
      for (const t of dep.database.tables) reachable.add(t);
    }
    for (const t of m.database.dml) {
      if (!reachable.has(t)) {
        errors.push(
          `[${m.slug}] database.dml table "${t}" is neither a table of a required extension nor core-whitelisted (${CORE_DML_WHITELIST.join(", ")})`,
        );
      }
    }
  }

  return errors;
}

/** Tables in `public` owned by the host — extension SQL may never DDL these. */
const SQL_FORBIDDEN_PATTERNS: [RegExp, string][] = [
  [
    /\bauth\.(?!uid\s*\(|jwt\s*\(|role\s*\()/i,
    "references the auth schema (only auth.uid()/auth.jwt()/auth.role() are allowed)",
  ],
  [/\bstorage\./i, "references the storage schema"],
  [/\b(create|alter|drop)\s+(role|user)\b/i, "contains role DDL"],
  [/\bgrant\b/i, "contains GRANT statements"],
  [/\brevoke\b/i, "contains REVOKE statements"],
];

const DDL_TABLE_RE =
  /\b(?:create\s+table(?:\s+if\s+not\s+exists)?|alter\s+table(?:\s+if\s+exists)?(?:\s+only)?|drop\s+table(?:\s+if\s+exists)?)\s+(?:public\.)?"?([a-z0-9_]+)"?/gi;

const DML_TABLE_RE =
  /\b(?:insert\s+into|update(?:\s+only)?|delete\s+from)\s+(?:public\.)?"?([a-z0-9_]+)"?/gi;

/**
 * Best-effort SQL ownership lint (§1.1): an extension's migrations may only
 * CREATE/ALTER/DROP its own declared tables, may DML its own tables plus the
 * whitelisted tables of extensions it `requires`, and may never touch
 * `auth.*` / `storage.*` / role + grant DDL. Regex-based — flags loudly, no
 * SQL parser claimed.
 */
export function lintExtensionSql(
  sql: string,
  opts: {
    slug: string;
    file: string;
    ownTables: string[];
    /** Extra tables DML is allowed on (from `requires` + declared core access). */
    allowedDmlTables?: string[];
  },
): string[] {
  const errors: string[] = [];
  const where = `[${opts.slug}] ${opts.file}`;
  // Strip line comments so commented-out SQL doesn't trip the lint.
  const cleaned = sql.replace(/--[^\n]*/g, "");

  for (const [re, message] of SQL_FORBIDDEN_PATTERNS) {
    if (re.test(cleaned)) errors.push(`${where}: ${message}`);
  }

  const own = new Set(opts.ownTables);
  const dmlAllowed = new Set([
    ...opts.ownTables,
    ...(opts.allowedDmlTables ?? []),
  ]);

  for (const match of cleaned.matchAll(DDL_TABLE_RE)) {
    const table = match[1];
    if (table && !own.has(table)) {
      errors.push(
        `${where}: DDL on table "${table}" which is not declared in database.tables`,
      );
    }
  }
  for (const match of cleaned.matchAll(DML_TABLE_RE)) {
    const table = match[1];
    if (table && !dmlAllowed.has(table)) {
      errors.push(
        `${where}: DML on table "${table}" which is neither owned nor whitelisted via requires`,
      );
    }
  }

  return errors;
}
