# Extension Framework for the Dream Starter Kit — Design Plan

> **Status: implementation in progress** on `feat/extensions-framework`.
> This document is the source of truth for the build. Progress is tracked by
> the phase checklist in
> [§8](#8-refactor-of-existing-features-resquash--rename--user-decision) —
> each phase is checked off when it lands as a commit with the full suite green.

## Context

The kit today ships features as hand-wired vertical slices (reminders, chat, notifications, billing, the `/a` dashboard): a migration in `supabase/migrations/`, validators + hooks in `packages/app`, screens in both apps, optional API routes/edge functions, and tests. Every slice touches the same hardcoded integration points: the `navMain` array in `apps/nextjs/src/components/app-sidebar.tsx`, the Expo home buttons in `apps/expo/src/app/(app)/index.tsx`, the barrel in `packages/app/src/index.ts`, the `collections` array in `apps/nextjs/src/payload.config.ts`.

The goal: turn the kit into a host for **installable extensions** that live in separate GitHub repos, install with one command or one click in `/admin`, update automatically when authors publish, allow local modifications without losing the update path, and own dedicated tables/collections never shared with other extensions. Ease target: Shopify Apps, not WordPress plugins.

**The governing constraint:** Next.js and Expo are statically bundled and Vercel serverless has a read-only filesystem with no git/pnpm. There is no honest runtime plugin loading. Therefore *"installing an extension" always means "code lands in the git repo, CI gates it, Vercel redeploys, and the existing boot-time bootstrap applies migrations."* The framework's job is to make that pipeline feel like one click.

**User decisions (confirmed):**
1. **One-time resquash** of the baseline migration + rename all extension tables to the `ext_<slug>_*` convention (e.g. `ext_chat_threads`).
2. **Fully automatic updates by default** (scheduled workflow opens + auto-merges update PRs when CI passes), with opt-out flags.
3. **Curated extension catalog in v1** (browsable "store" in the admin panel).
4. **First-party extensions:** Dashboard (home screen `/a`), Chat, Reminders, Notifications (a **shared service** all extensions can use), Billing (Stripe-only). Auth/profile, files, tags, theming, the CMS content registry, the app shell, and the framework itself stay core.
5. **CMS-driven menus:** every extension contributes menu items to the web sidebar and native app; when an extension is installed **and enabled** it appears in the menu, and the admin can **rename, reorder, and change the icon** from Payload (`/admin`). Icon storage is a plain name field for now — a lucide/material icon-picker integration is a planned follow-up by the user.
6. **Per-extension settings screens:** each extension gets a settings screen in Payload under a new **Extensions** admin nav group (alongside Content, Commerce, …); extension authors define the configurable fields.

---

## The model in one paragraph

An extension is a **vendored pnpm workspace package** at `extensions/<slug>/` (its own GitHub repo upstream), with a typed manifest and a strict exports split that keeps server/Payload code out of the native bundle. The host consumes extensions exclusively through **committed generated registry files** produced by `pnpm ext sync` — static imports, no runtime discovery, no hook/filter spaghetti. Pages are wired via generated two-line route stubs (default mount `/a/<slug>`, with validated **mount overrides** so system extensions can claim `/a`, `/billing`, `/pricing`); the server API via one hand-written catch-all dispatcher that enforces auth + rate limiting centrally. Supabase migrations are copied into `supabase/migrations/` with lock-pinned versions and flow into the existing inlined-JSON runtime bootstrap unchanged; Payload collections, **globals, plugins**, and migrations merge into `payload.config.ts`. Provenance lives in a committed `extensions.lock` plus hidden pristine-snapshot refs (`refs/ext-base/<slug>`) that make updates a real git three-way merge — so users can modify vendored code and still take upstream updates. The admin panel installs/updates/removes by dispatching a GitHub Actions workflow that runs the same CLI and opens a PR; merging deploys; boot applies migrations. Forgetting `ext sync` fails `pnpm test` via a drift test (same pattern as the existing `db:gen-migrations` drift test).

---

## 1. What an extension is

### 1.1 Naming & namespacing (isolation guarantee)

| Thing | Rule | Example (chat) |
|---|---|---|
| slug | `^[a-z][a-z0-9-]{1,30}$`, globally unique | `chat` |
| directory / package | `extensions/<slug>/`, `@acme/ext-<slug>` | `extensions/chat`, `@acme/ext-chat` |
| Supabase tables | `ext_<slug_snake>` or `ext_<slug_snake>_*` in `public`, RLS required | `ext_chat_threads`, `ext_chat_messages` |
| Payload collection slugs | `ext-<slug>-*` (→ `cms.ext_<slug>_*` tables; admin **labels** stay clean, e.g. "Plans") | `ext-billing-plans` |
| Payload globals | `ext-<slug>-*` | `ext-billing-pricing-settings` |
| Web routes | `/a/<slug>/…` default; per-route `mount` override (validated) | `/a/chat/[threadId]`; billing mounts `/billing` |
| Native routes | `app/(app)/a/<slug>/…` default; `mount` override | dashboard mounts the home screen `index` |
| Server API | `/api/ext/<slug>/…` | `POST /api/ext/chat/stream` |
| Edge functions | `<slug>-*` | `reminders-process`, `billing-stripe-webhook` |
| Env vars | `EXT_<SLUG>_*` / `NEXT_PUBLIC_EXT_<SLUG>_*` / `EXPO_PUBLIC_EXT_<SLUG>_*` | `EXT_CHAT_MAX_TOKENS` |

`ext sync` hard-errors on any cross-extension or core collision (tables, collection/global slugs, routes + mounts, env names, edge functions). Mount overrides are checked against a **reserved core list** (`/admin`, `/cms-api`, `/api`, auth routes, `/profile`, …) and against each other — only one extension may claim a mount. A cheap SQL lint verifies the extension's migrations only `CREATE/ALTER` tables it declares and never touch `auth.*`, `storage.*`, or role/grant DDL (best-effort, flagged loudly).

**Cross-extension access:** an extension may declare `requires: ["notifications"]` — sync validates the dependency is installed, whitelists its tables for DML (never DDL), and permits importing its exported service APIs (§1.5). Used by reminders → notifications, and by anything premium-gated → billing.

### 1.2 Extension repo layout (identical to what lands in `extensions/<slug>/`)

```
extensions/chat/
  extension.config.ts        manifest — default export via defineExtension()
  package.json               @acme/ext-chat, exports map below
  tsconfig.json / eslint.config.ts / vitest.config.ts   (host conventions)
  src/
    index.ts                 CLIENT-SAFE barrel: validators + react-query hooks (web+native shared)
    validators/  hooks/      same shapes as packages/app today (zod/v4, useSupabase())
    env.ts                   { server?: ZodRawShape; client?: ZodRawShape } — zod-only
    web/index.ts + screens   RSC/client components; may import next/*, Payload Local API
    native/index.ts + screens  react-native-reusables screens
    server/index.ts          `import "server-only"`; exports routes: ExtRouteTable (+ service APIs, §1.5)
    payload/index.ts         exports { collections, globals, plugins, migrations, seed, settings }
  supabase/
    migrations/001_initial.sql   LOCAL sequence numbers — never timestamps (see §3)
    drop.sql                     teardown DDL for `ext remove`
    functions/<slug>-*/          optional edge functions
  tests/
    *.test.ts                vitest unit
    rls/*.rls.test.ts        uses @acme/rls-tests harness
    e2e/*.spec.ts            uses @acme/web-e2e helpers
```

### 1.3 The exports split (bundle safety — the hard requirement)

```jsonc
"exports": {
  ".":         "./src/index.ts",        // client-safe only
  "./env":     "./src/env.ts",
  "./web":     "./src/web/index.ts",    // Next/DOM allowed
  "./native":  "./src/native/index.ts", // RN allowed
  "./server":  "./src/server/index.ts", // first line: import "server-only"
  "./payload": "./src/payload/index.ts" // imports payload — unreachable from clients
}
```

Three layers keep Metro/native safe: (1) the generated Expo registry only ever imports `.` and `./native`; (2) poison pills (`server-only`, the `payload` import) fail any wrong-side compilation; (3) `no-restricted-imports` rules in `tooling/eslint` (`/server`+`/payload` only inside `apps/nextjs`, `/native` only inside `apps/expo`). Source-only `.ts` exports match the existing transpile model (Next `transpilePackages`, Metro package-exports resolution — verify on SDK 54 early; fallback is flat per-entry packages).

### 1.4 Manifest (types live in new `packages/ext-kit`)

```ts
defineExtension({
  slug: "chat", name: "AI Chat", version: "1.0.0",     // semver, = git tag, = package.json
  kitCompat: ">=1.0.0 <2",
  requires: ["notifications"],                          // cross-ext dependency (DML + service imports)
  // nav entries are DEFAULTS — seeded into the CMS-driven menu on install (§2.5),
  // where staff rename/reorder/re-icon/toggle them at runtime
  nav: { web: [{ title: "Chat", href: "/a/chat", icon: "IconMessageCircle", order: 20 }],
         native: [{ title: "Chat", href: "/a/chat", icon: "IconMessageCircle", order: 20 }] },
  routes: {
    web:    [{ path: "", component: "ChatHome" }, { path: "[threadId]", component: "ChatThread" }],
    native: [/* same shape */],
  },
  // Route options: { path, component, area?: "app" | "public", mount?: "/billing" }
  //   area  — which web layout group the stub is generated under (default "app" = authed shell)
  //   mount — absolute mount override instead of /a/<slug>/<path>; validated vs reserved + collisions
  widgets: { web: "ChatWidget", native: "ChatWidget" },  // optional dashboard widget (export names)
  server: { routes: true, edgeFunctions: [] },
  database: { tables: ["ext_chat_threads", "ext_chat_messages"] },
  cms: { collections: [], globals: [], hasPlugins: false, hasMigrations: false, hasSeed: false,
         hasSettings: true },                           // ./payload exports `settings` (§1.7)
  env: { hasServer: true, hasClient: false },           // shapes live in ./env
})
```

`@acme/ext-kit` also exports the server contract: `ExtRouteTable = Record<"METHOD /path", (req, ctx: { user, supabase, params }) => Promise<Response>>` and `ExtSeedStep`. The manifest is consumed **only by codegen** (loaded with jiti/tsx at sync time); client bundles never import it — sync bakes nav/routes/widgets into the registries as literals with real static icon imports.

### 1.5 Cross-extension services (the notifications pattern)

Some extensions are **shared capabilities**. The pattern: the providing extension exports a typed service API from the appropriate entry; consumers declare `requires` and import it directly (static workspace imports — no runtime service locator). Sync fails with a clear error if a required extension is missing.

- **Notifications (the canonical service):**
  - `@acme/ext-notifications/server` exports `notify(db, { userId, type, title, body, data? })` — inserts an `ext_notifications` row and fans out Expo push to `ext_notifications_push_tokens` (accepts either a user-session client for self-notifications or the service-role client in edge functions/webhooks).
  - `@acme/ext-notifications` (client) exports `useNotifications()`, `useUnreadCount()`, `useMarkNotificationRead()` — any extension (or the dashboard) can render a badge.
  - Edge functions that can't import workspace code (Deno) follow a documented SQL contract: insert into `ext_notifications` + read `ext_notifications_push_tokens` (declared via `requires`, whitelisted by the SQL lint).
- **Billing as a service:** `@acme/ext-billing` (client) exports `usePremium()`; any extension gates features behind it (`requires: ["billing"]`). Mobile keeps reading the subscriptions mirror table read-own under RLS — golden rule #4 intact, table renamed `ext_billing_subscriptions`.

This stays Shopify-simple: services are just typed package exports + a validated dependency declaration — no event bus, no filter hooks.

### 1.6 Cross-platform contract (Next.js + Expo are both first-class)

Extensions are **dual-platform by default** — the scaffold generates both screen trees, and the framework guarantees each layer works on both runtimes:

- **Manifest platform flags:** `platforms: { web: true, native: true }` (default both). Sync validates consistency — a native nav entry requires native routes, etc. A web-only extension (e.g. one that's purely an `/admin` tool) simply omits native; the Expo registry and stubs skip it with no native bundle impact. Native-only is equally legal.
- **Shared client layer is RN-safe by construction:** the `.` barrel (validators + hooks) may import only `zod`, `@tanstack/react-query`, `@acme/api` (`useSupabase()`), `@acme/config`, and `@acme/cms` types — all already proven cross-platform by the existing `packages/app`. The ESLint restricted-import rules ban `react-dom`, `next/*`, and node built-ins from `.`/`./native`; the `server-only`/`payload` poison pills catch anything that slips through at compile time.
- **UI primitives per platform:** web screens (`./web`) use `@acme/ui` (shadcn) + Tailwind; native screens (`./native`) use react-native-reusables + NativeWind. **Framework prerequisite:** the native primitives currently living in `apps/expo/src/components` are extracted to a new shared package **`packages/ui-native` (`@acme/ui-native`)** — same move `@acme/ui` already made for web — so extensions get consistent, themable native components. The Expo app consumes the same package (apps stay thin).
- **Styling compiles for extension sources:** Tailwind/NativeWind only style classes they can see. The web Tailwind setup gains an `@source "../../../extensions/*/src/{web,index,hooks}*"`-style glob (Tailwind v4) and the Expo `tailwind.config` content array gains `../../extensions/*/src/{native,index,hooks}/**` — added **once** during framework setup (static globs, no per-extension codegen). Extension screens use the same design tokens from `@acme/tailwind-config/theme`, so the editable theme-settings global styles extension UI for free.
- **Native reaches extension APIs the same way it does today:** native hooks call `/api/ext/<slug>/…` with an `apiBaseUrl` + Bearer token (the existing `useSendMessage`/`EXPO_PUBLIC` pattern); web calls relative with cookies. The catch-all dispatcher (§2) authenticates **both**: Supabase session cookie (web) or `Authorization: Bearer` access token (native) — one host-owned auth shim, no per-extension auth code.
- **Native-only capabilities live in `./native`:** e.g. the notifications extension's `registerForPushNotifications()` (currently `apps/expo/src/lib/push.ts`) moves into `@acme/ext-notifications/native`. Expo config-plugin needs (new native modules requiring `app.json` plugins or dev builds) are out of scope for v1 — extensions must work in the kit's existing Expo Go / EAS setup; a manifest `expoPlugins` field is a documented future follow-up, flagged at install if declared.
- **Env split mirrors the apps:** `NEXT_PUBLIC_EXT_*` / `EXPO_PUBLIC_EXT_*` client vars flow through the same generated zod shapes into `apps/nextjs/src/env.ts` and `apps/expo/src/lib/env.ts` respectively; server vars never reach either client bundle.
- **CI keeps native honest:** `pnpm typecheck` covers `apps/expo` (which now imports the native registries + stubs), and the framework phase adds an `expo export` smoke check to the integration job so a server-only import leaking into the native graph fails the PR — this is the backstop for third-party extensions, whose code core maintainers don't review.

### 1.7 Extension settings (author-defined fields, admin-edited — user decision #6)

Every extension can ship a **settings screen** that appears in `/admin` under a new **Extensions** admin nav group (a sibling of Content, Community, Commerce, Marketing):

- **Authoring:** the extension's `./payload` entry exports `settings`, built with an ext-kit helper that takes only what the author should control — the fields:
  ```ts
  // extensions/chat/src/payload/settings.ts
  export const settings = defineExtensionSettings({
    fields: [
      { name: "systemPrompt", type: "textarea", defaultValue: "You are a concise, friendly assistant." },
      { name: "maxHistoryMessages", type: "number", defaultValue: 20 },
    ],
  });
  ```
  `defineExtensionSettings()` wraps the fields in a Payload **Global** with framework-enforced invariants: slug `ext-<slug>-settings`, `label: <extension name> → "Settings"`, `admin.group: "Extensions"`, access `read: isStaff / update: isAdmin` by default (an author may opt fields or the whole global into `publicRead` for client-consumed config like feature toggles — never secrets). Sync registers it through the payload registry like any other global; types flow through `pnpm cms:gen-types` into `@acme/cms`, so settings are fully typed.
- **Consuming:** server code reads `getExtensionSettings("chat")` (ext-kit server helper over `payload.findGlobal`, request-cached, defaults applied — so an extension works before the admin ever opens the screen); `publicRead` settings are additionally reachable from web/native clients via a `useExtensionSettings("chat")` hook over the `/cms-api` REST global endpoint.
- **Settings vs env, documented rule:** secrets and deploy-time config (API keys, webhook secrets) stay in the zod env schema (golden rule #3); anything a non-technical admin should tune at runtime without a redeploy (copy, prompts, limits, toggles) belongs in extension settings.
- **The Extensions admin group** also houses the framework's own screens — the `kit-extensions` collection (enable/disable), `nav-items` (menu editing, §2.5), and the Extensions manage/install view (§6) — so everything extension-related lives under one nav group in the admin panel.
- Defaults come from field `defaultValue`s (no seed step needed); authors needing seeded relational data still use `seed` steps. Settings globals are dropped on `ext remove` via the same cms drop migration path (§3.3). All extension settings are version controlled on Versions tab and have Payload APIs tab.

---

## 2. How the host consumes extensions — `pnpm ext sync`

New tooling package `tooling/ext` (`@acme/ext-tools`), root scripts `ext` / `ext:sync`. The sync pipeline:

1. **Discover + validate** all `extensions/*/extension.config.ts` (zod, uniqueness, prefixes, mounts vs reserved list, `requires`, package.json name/version match, SQL ownership lint).
2. **Write generated registries** (committed, headed "GENERATED — do not edit", in `.prettierignore`):
   - `apps/nextjs/src/ext/registry.client.generated.ts` — **nav defaults** (manifest entries, consumed by the CMS reconcile in §2.5 — not rendered directly), `extWidgets` (widget component imports), `hasExtension()`, the icon-name → component map
   - `apps/nextjs/src/ext/registry.server.generated.ts` — slug → `ExtRouteTable` (static imports of `@acme/ext-*/server`)
   - `apps/nextjs/src/ext/registry.payload.generated.ts` — `extCollections`, `extGlobals` (incl. each extension's settings global, §1.7), `extPlugins`, `extPayloadMigrations`, `extSeedSteps`
   - `apps/nextjs/src/ext/env.generated.ts` — merged zod shapes from `@acme/ext-*/env`
   - `apps/nextjs/ext-packages.generated.json` — transpilePackages additions (next.config.js is CJS-loaded)
   - `apps/expo/src/ext/registry.generated.ts` — native nav defaults + widgets + icon map
   - **Route stub subtrees** (regenerated wholesale each run): default under `apps/nextjs/src/app/(frontend)/(app)/a/<slug>/**` and `apps/expo/src/app/(app)/a/<slug>/**`; `area: "public"` routes under `(frontend)/(public)/…`; `mount` overrides generate the stub at the claimed path (e.g. `(app)/a/page.tsx`, `(public)/pricing/page.tsx`, expo `(app)/index.tsx`). All stub locations are recorded in the lock so sync owns and can delete them on change/removal.
3. **Materialize Supabase migrations** into `supabase/migrations/` (lock-pinned versions, §3) + copy edge functions into `supabase/functions/`.
4. Run `pnpm db:gen-migrations` (refresh the runtime-bootstrap JSON).
5. Rewrite the fenced `# --- extensions (generated) ---` block in `.env.example`.
6. Print next steps (`pnpm db:reset && pnpm db:gen-types`, `pnpm cms:gen-types` if cms changed).

**Drift enforcement:** `apps/nextjs/src/ext/registry-drift.test.ts` (vitest, sibling of the existing `migrations-drift.test.ts`) recomputes expected registry contents from manifests + lock and compares to committed files → forgetting `ext sync` fails `pnpm test` and CI.

### Routing decision: generated stubs for pages, one catch-all for the API

- **Pages → generated two-line stubs.** Expo Router has no programmatic route registration, so stubs are required on native regardless; using the same model on web preserves full per-route Next features (RSC, metadata, loading, code-splitting) that a catch-all would forfeit. Stub subtrees are machine-owned (deleted + regenerated every sync) so users never patch them — local customization happens in the extension's own `src/`.
  ```tsx
  // apps/nextjs/src/app/(frontend)/(app)/a/chat/[threadId]/page.tsx  (GENERATED)
  export { ChatThread as default } from "@acme/ext-chat/web";
  ```
- **Server API → one hand-written catch-all**: `apps/nextjs/src/app/api/ext/[ext]/[[...route]]/route.ts`. It resolves the slug in the server registry, then runs host-owned middleware in one choke point — Supabase auth accepting **both session styles** (cookie for web, `Authorization: Bearer` for native, matching today's `/api/chat`), the existing sliding-window rate limiter from `@acme/config`, JSON 404/405 — before matching `"METHOD /path"` in the extension's route table. This is how golden rule #6 (authed, rate-limited AI/server routes) is enforced for *every* extension endpoint. Streaming responses pass through untouched (the chat route already streams a `Response`). Routes that must be public + signature-verified (Stripe webhooks) stay in edge functions or Payload plugin endpoints — the dispatcher is authed-only by design.

### 2.5 CMS-driven navigation & extension enablement (user decision #5)

Manifest nav entries are **defaults, not the menu**. The menu itself lives in Payload so staff can edit it at runtime without a deploy:

- **`kit-extensions` collection** (core, framework-owned, **Extensions** admin group §1.7): one row per installed extension — `slug` (unique, read-only), `name`, `version` (read-only, mirrored from the bundled lock), **`enabled` (checkbox, default true)**, `system` (read-only flag for dashboard/billing whose mounts the app shell depends on — disabling shows a warning). Update access `isAdmin`; rows are created/updated only by the framework (Local API, `overrideAccess`).
- **`nav-items` collection** (core, framework-owned, **Extensions** admin group, `orderable: true` → Payload's native drag-to-reorder list): fields `key` (unique, read-only, e.g. `ext:chat:0` / `core:profile`), `extension` (relationship to `kit-extensions`, read-only, empty for core items), **`label`** (rename), `href` (read-only, from manifest), **`icon`** (plain text name for now, validated against the generated icon map with graceful fallback; the field is deliberately a string so the user's later lucide/material picker integration swaps in the admin UI without a schema change), **`order`** (drag-reorder), `platforms` (select hasMany: web/native), **`enabled`** (per-item toggle). Read = `anyone` (the native app fetches it), update = `isStaff`, create/delete = framework-only. Core entries (Profile, etc.) are rows too, so the admin reorders the *whole* menu uniformly.
- **Boot-time reconcile** (`apps/nextjs/src/lib/ext/reconcile-nav.ts`, invoked from `instrumentation.ts` after the Payload warm-up, idempotent + lock-guarded like the existing bootstrap patterns; also registered as a cms seed step for local `db:reset`): diff the generated nav defaults against the collections — insert rows for newly installed extensions (`enabled: true`, manifest label/icon/order), update read-only fields (href/version), delete rows whose extension was removed. **Never overwrites staff edits** — label/icon/order/enabled are written only on row creation. This is how "install → it shows up on the menu" works with zero manual steps: merge the install PR → deploy → boot reconcile → menu row exists.
- **Rendering — web:** the authenticated app-shell layout (`(app)/layout.tsx`, RSC) fetches enabled nav items (joined against enabled extensions) via the Payload Local API, sorted by `order`, and passes them to `app-sidebar.tsx`, which maps `icon` names through the generated icon registry (unknown name → default icon). Cached per-request with a short `revalidateTag("nav")` invalidated by an `afterChange` hook on both collections — menu edits appear without redeploy.
- **Rendering — native:** a `useNavMenu()` hook (in `@acme/ext-kit` client or `packages/app`) fetches `/cms-api/nav-items` REST (public read, filtered to enabled + native platform), typed by `@acme/cms`; the home screen/menu renders it dynamically with react-query caching and last-known-good fallback offline. Icon names resolve through the same generated map (native icon set).
- **Enablement gating beyond the menu:** the API dispatcher checks the extension's `enabled` flag (Local API, ~30s in-memory cache) and 404s disabled extensions; generated web stub subtrees include a per-extension `layout.tsx` that server-checks `enabled` and calls `notFound()`; the dashboard filters widgets to enabled extensions. Disabling hides + blocks an extension at runtime without uninstalling it (code stays deployed — `remove` is the real uninstall).

### One-time host integration edits (then never touched again)

- `(app)/layout.tsx` + `app-sidebar.tsx`: render the CMS-driven menu (§2.5); the hardcoded `navMain` array is deleted
- `apps/expo/src/app/(app)/_layout.tsx`: HeaderBell gated on `hasExtension("notifications")` + its nav-item enabled state; home screen is the dashboard extension's mounted stub; menu rendered from `useNavMenu()`
- `payload.config.ts`: `collections: [...core /* incl. kit-extensions + nav-items */, ...extCollections]`, `globals: [...core, ...extGlobals]`, `plugins: [...core, ...extPlugins]`, `prodMigrations: mergeByTimestamp(migrations, extPayloadMigrations)`
- `apps/nextjs/src/env.ts` + `apps/expo/src/lib/env.ts`: merge generated env shapes
- `payload/seed.ts`: append `extSeedSteps` after core steps (rides the existing idempotent `/api/cms/seed` + `/cms-setup` progress flow for free)
- `next.config.js`: `transpilePackages: [...core, ...require("./ext-packages.generated.json")]` + legacy redirects (`/reminders → /a/reminders`, `/chat → /a/chat`, `/notifications → /a/notifications`; `/a`, `/billing`, `/pricing` keep their paths via mount overrides)

### Typed DB access

Nothing new: extension migrations land in `supabase/migrations/`, so `pnpm db:gen-types` regenerates `packages/api/src/types.ts` to include `ext_*` tables and extension hooks get full `Tables<'ext_chat_threads'>` typing via the same `useSupabase()`. (Documented implication: extension hooks only typecheck inside a host that has synced their migrations — which is exactly the vendored model; authors develop inside a kit clone.)

---

## 3. Migrations

### 3.1 Supabase (public schema)

Extensions ship **local sequence numbers** (`001_initial.sql`, `002_add_x.sql`) — authors can never collide with host history or each other. On first sight of a new file, sync assigns the next 14-digit version, **pins it in `extensions/.ext-lock.json`**, and copies it:

```
extensions/chat/supabase/migrations/002_add_attachments.sql
  → (pin "chat/002" = "20260611093015" in lock, deterministic forever after)
  → supabase/migrations/20260611093015_ext_chat_002_add_attachments.sql
  → pnpm db:gen-migrations → supabase-migrations.generated.json
  → runtime bootstrap applies + records in supabase_migrations.schema_migrations (UNCHANGED code)
```

Filenames satisfy the existing `^\d{14}_.+\.sql$` contract in `lib/db/bootstrap-core.ts` — **zero changes to the bootstrap**. Pinned files are never renamed (deployed ledgers stay valid); sync hard-errors if an already-synced source file's *content* changed (append-only on both sides). Local dev just works: `supabase db reset` applies them like any migration.

### 3.2 Payload (cms schema)

Extension `./payload` exports `migrations: {up, down, name}[]` with names `YYYYMMDD_HHMMSS_ext_<slug>_<desc>`. The generated payload registry concatenates them; `payload.config.ts` merges core + extension migrations sorted by timestamp into `prodMigrations`. Payload's `cms.payload_migrations` ledger keys by name → idempotent boot runs. Dev is unaffected (`push: true` derives schema from the merged collections/globals). Authoring is wrapped in one command — `pnpm ext payload-migrate <slug>` — which runs `payload migrate:create` in a clean host and relocates the output into the extension (Payload's whole-config-diff reality, confined behind one command).

**Extension-provided Payload plugins** (e.g. billing's `stripePlugin`) are merged into the config's `plugins` array. A plugin can mutate the whole Payload config, so this is the widest extension power — fine for first-party, and for third-party it's surfaced prominently in the install PR body ("this extension registers a Payload plugin").

### 3.3 Removal

`pnpm ext remove <slug> [--keep-data]`: read manifest + `drop.sql` first → append a host drop migration (`<ts>_drop_ext_<slug>.sql`, from `drop.sql` or generated `drop table if exists … cascade` per declared table) → scaffold the cms drop migration into the **core** payload migrations dir (the package is about to vanish) → delete `extensions/<slug>/`, tombstone in lock (version pins never reused) → regenerate registries + stubs + JSON. `--keep-data` skips the drop (code gone, tables orphaned-but-harmless; reinstall reattaches since the template writes `if not exists`-friendly DDL). Removal refuses to proceed while other installed extensions `require` the target (e.g. removing notifications while reminders is installed). Admin removal never auto-merges and the PR body carries the data-loss warning + exact drop SQL.

---

## 4. Distribution model: vendored copy + `extensions.lock` + pristine-base refs

**Rejected:** git submodules (code not in repo — breaks "own your code", Vercel clones, zip origins) and git subtree (merge metadata lives in commit messages; a single GitHub **squash merge** destroys it; no zip story).

**Chosen:** plain vendored copy + committed lockfile + hidden snapshot refs.

- **`extensions.lock`** (repo root, committed, CLI-owned): per slug → `version`, `source` (`{type: "github", repo, ref, commit}` | `{type: "zip", sha256, filename}` | `"local"`), `baseCommit`, `kitCompat`, `installedVia`, migration version pins, generated-stub paths, tombstones, optional `pinned: true` (excludes from auto-update).
- **Pristine-base ref chain:** every install/update writes a synthetic commit containing only the *unmodified* extension tree and pushes it to hidden ref `refs/ext-base/<slug>` (chained parents — all old bases stay reachable; invisible in branches/PRs/clones; squash-proof). `lock.baseCommit` pins the current merge base.
- **Updates are a real three-way merge:** base = pinned pristine tree, ours = current `extensions/<slug>/` (with the user's local modifications), theirs = new upstream version — executed with `git merge-tree --write-tree`. Clean merge (the common case) proceeds automatically; conflicts are materialized with standard markers and surfaced (CLI: file list + `--continue`; admin: committed to the PR branch, labeled `ext-conflicts`, body suggests "open this PR in Claude Code to resolve").
- Zip-origin extensions get the same snapshot → same three-way updates. If a ref is ever lost, GitHub origins rebuild from `source.commit`; zip origins degrade to "replace + full diff for review" (documented, never silent).

---

## 5. Lifecycle CLI — `tooling/ext` (one implementation, two front doors)

The CLI is the **single implementation**; the admin panel's GitHub Actions workflow runs the same commands with `--ci --json`.

- `pnpm ext add <github-url[#vX.Y.Z] | path.zip>` — resolve latest compatible tag (or given) → shallow clone / unzip → validate (§1.1, manifest, license) → vendor → snapshot ref → lock → `pnpm install` → `ext sync` → `db:gen-migrations` → typecheck → print required env vars + next steps.
- `pnpm ext update [slug] [--to vX.Y.Z] [--continue]` — three-way merge as above; new upstream migrations get fresh pins (append-only); advance snapshot + lock; sync; typecheck.
- `pnpm ext remove <slug> [--keep-data]` — §3.3.
- `pnpm ext list / status [--json]` — lock + local-modification status (diff vs `baseCommit` tree); `status` checks upstream tags and reports up-to-date / update-available / incompatible. `--json` feeds the scheduled workflow + admin page.
- `pnpm ext create <slug>` — scaffold from `tooling/ext/templates/`: manifest, exports map, sample `ext_<slug>_items` table migration following the canonical CLAUDE.md RLS pattern + `drop.sql`, sample validator/hook/web RSC page/native screen/authed `GET /ping` route/dashboard widget, a sample **settings global** (`defineExtensionSettings` with one field, read back via `getExtensionSettings` in the sample route), passing unit + RLS + e2e samples, README. Lock entry `source: "local"` (excluded from update checks). Finishes by running `ext sync`.
- `pnpm ext eject <slug> [--repo url]` — publish to its own GitHub repo (repo root = package root, byte-identical layout), drop in template extension CI, flip lock to `github` origin with fresh snapshot.
- `pnpm ext payload-migrate <slug>` — §3.2.

---

## 6. Admin panel: catalog, install, zip upload, automatic updates

### Surface

Custom Payload admin view **`/admin/extensions`** (registered via `admin.components.views` in `payload.config.ts`, following the existing SeedGate/ThemeStyleProvider pattern; `admin`-role gated). Tabs:

1. **Installed** — from the *bundled* lock (sync emits a module importing `extensions.lock`, so it's readable on serverless): version, origin, "locally modified (N files)" flag, missing-env-var warnings (manifest env list vs runtime), update badges, the runtime **Enable/Disable toggle** (writes `kit-extensions.enabled`, §2.5), a link to its menu items in `nav-items`, and per-extension actions (Update, Remove, Pin).
2. **Catalog (v1)** — a browsable store. The catalog is a JSON index in a kit-maintained registry repo (e.g. `dream-extensions-catalog`: entries with slug, name, description, category, icon/screenshot URLs, repo URL, latest version, kitCompat). The page fetches `EXT_CATALOG_URL` (env, default = official registry raw URL; founders can fork and point at their own), cross-references the lock for installed/update state, and renders cards with **one-click Install**. The catalog is presentation only — install mechanics are identical to install-by-URL. The five first-party extensions are its first entries.
3. **Install from GitHub URL** and **Upload ZIP** forms.
4. **Operations** — live panel of in-flight workflow runs / open `extension-op` PRs with states: Queued → Running checks → Awaiting review / Conflicts → Merged, deploying → **Active** (detected when the *bundled* lock contains the new version — an honest signal the deploy actually rolled).

### Server mechanics — dispatch a workflow, open a PR

The deployed app can't run git/pnpm, and composing commits via the GitHub Data API couldn't run `ext sync`/typecheck — so **all mutations dispatch `.github/workflows/extension-ops.yml`** (`workflow_dispatch`, inputs: op/source/slug/version/keep_data/sha256), which checks out main + `refs/ext-base/*`, runs the real CLI, pushes branch `ext/<op>-<slug>-<run_id>`, and opens a labeled PR. Auth: a **fine-grained PAT** (not a GitHub App — single-repo self-owned setup doesn't justify app ceremony), stored as `GITHUB_OPS_TOKEN` (Vercel env, optional → without it the page is read-only with copy-paste CLI instructions) and as repo secret `EXT_OPS_TOKEN` — required because pushes by the default `GITHUB_TOKEN` don't trigger `pull_request` CI. `GITHUB_REPO` defaults from Vercel-injected `VERCEL_GIT_REPO_OWNER/_SLUG`. Concurrency group serializes ops.

**ZIP path:** admin uploads (staff-only, size-capped) → private Supabase Storage bucket `extension-uploads` → server validates `extension.config` shape, computes sha256 → dispatch with a short-lived signed URL + hash → runner re-verifies hash → identical to GitHub install; lock records zip origin. *"Performs any necessary migrations"* = the boot-time bootstrap after the merge deploys; the UI words it that way ("Migrations apply automatically when the new version deploys").

### Updates — fully automatic by default (user decision)

- A daily `schedule` trigger on `extension-ops.yml` runs `pnpm ext status --json`; for each compatible new version it opens an update PR and enables auto-merge (squash) — CI green ⇒ merged ⇒ deployed ⇒ migrations at boot. **No human in the loop** unless: merge conflicts (`ext-conflicts` label, requires resolution), incompatible `kitCompat`, the extension is `pinned`, or the op is a removal.
- Opt-outs (repo variables / env): `EXT_AUTO_UPDATE=off` (badge-only, one-click update), `EXT_AUTO_MERGE=off` (PRs open but await review), per-extension Pin toggle in the admin UI.
- The trust tradeoff is stated plainly in docs and in the install confirmation: with auto-update on, extension authors can effectively ship code to your server gated only by your CI. Pinning + review mode are the brakes.

---

## 7. Versioning, compatibility, trust

- **Kit version:** root `package.json` `version` + exported `KIT_VERSION` in `packages/config` (unit test asserts they match). Majors for breaking extension-API changes.
- **Extension version:** manifest semver = git tag = package.json (template CI enforces). `kitCompat` semver range checked at add/update/status/dispatch (defense in depth; `--force` is CLI-only). After a breaking kit upgrade, incompatible extensions are a *warning state*, not a kill switch — vendored code keeps running until updated.
- **Trust model, stated plainly:** installing an extension = trusting its author like an npm dependency — vendored code runs server-side with env access; its SQL runs as the privileged bootstrap role. No sandbox is claimed. Mitigations are review surface + hygiene: (1) **everything is a PR** — every line of installed/updated code is visible in a diff before it can run (this is why zip installs also route through a PR, never a direct commit); (2) pre-PR validation — manifest schema, **path confinement** (op may only write `extensions/<slug>/**` + known `ext sync` outputs, enforced by diffing the op commit against an allowlist, so an extension can't smuggle a modified `proxy.ts` or workflow), namespace/prefix/mount checks, SQL lint, Payload-plugin flagging, license gate (extension deps flow into the existing `pnpm license:check`), pnpm 10's default install-script blocking; (3) full existing CI on the PR (lint/typecheck/unit/license/RLS/e2e); (4) documented GitHub hardening (branch protection, fine-grained PAT).

---

## 8. Refactor of existing features (resquash + rename — user decision)

### What stays core vs. becomes an extension

- **Core (host):** auth + profile (`profiles`, orgs/memberships/invitations, auth validators, use-profile, use-delete-account, `delete-account` edge fn), `files`, tags, the CMS content/community/people/marketing registry + use-content, theming/branding, the app shell (sidebar + header chrome), and the extension framework itself.
- **First-party extensions (five):** shipped vendored (pre-installed) in the starter; published to their own repos via `ext eject` in a later phase, after which the lock points at the official upstreams and they participate in auto-update like any extension.

| Extension | Owns | Notes |
|---|---|---|
| **`dashboard`** | web mount `/a` (override), native mount `index` (the Expo home screen); no tables | Renders core quick links + the **widget grid**: every installed-and-enabled extension's declared `widgets` component (unread notifications badge, upcoming reminders, recent chats, plan/upgrade CTA from billing). This is what makes the home screen extensible instead of hand-edited. Marked `system: true` in `kit-extensions` (it owns the home mounts), as is billing. |
| **`notifications`** | `ext_notifications`, `ext_notifications_push_tokens`; `/a/notifications` screens; `POST /api/ext/notifications/push-test`; the `notify()` service (§1.5); native push registration (`registerForPushNotifications` moves from `apps/expo/src/lib/push.ts` into `./native`) | The **shared service** — all extensions may `require` it; HeaderBell gated on `hasExtension("notifications")`. |
| **`reminders`** | `ext_reminders`; `/a/reminders` screens; edge fn `reminders-process` | `requires: ["notifications"]` (the edge fn inserts notifications + reads push tokens via the documented SQL contract). |
| **`chat`** | `ext_chat_threads`, `ext_chat_messages`; `/a/chat` screens; `POST /api/ext/chat/stream` (streaming, authed, rate-limited via the dispatcher); settings global (system prompt, history window) | Keeps `DEFAULT_AI_MODEL` from `@acme/config` (golden rule #5 — model id stays centralized in core config); the runtime-tunable bits move to its settings screen (§1.7). |
| **`billing`** | `ext_billing_customers/products/prices/subscriptions`; web mounts `/billing` (app) + `/pricing` (public, `area: "public"`); native pricing screen; `/api/ext/billing/checkout` + portal route; edge fn `billing-stripe-webhook`; Payload: `ext-billing-plans/coupons/subscriptions` collections (labels "Plans"/"Coupons"/"Subscriptions", group "Commerce"), the current PricingSettings global becomes billing's **settings screen** (`ext-billing-settings`, Extensions group, §1.7), the `stripePlugin` config, sync-to-Stripe hooks, plan/coupon seed steps; `usePremium()` service | Stripe-only (golden rule #4 unchanged: mobile reads the subscriptions mirror read-own; renamed table). `requires` DML on core `tags`/`user_tags` (webhook auto-tagging) — core-table DML is declared the same way as cross-extension DML. Stripe env vars stay in core config (they're already optional) or move to `EXT_BILLING_*` — decide at implementation; webhook signature endpoints live in the edge fn + plugin endpoint, not the authed dispatcher. |

### The resquash (one-time, pre-clone exception to the append-only rule)

1. Edit `supabase/migrations/20260609000001_initial.sql` down to **core tables only** (remove reminders, chat_threads, chat_messages, notifications, push_tokens, customers, products, prices, subscriptions).
2. Each extension ships `supabase/migrations/001_initial.sql` creating the **renamed** tables with identical RLS/indexes: `ext_reminders`, `ext_notifications`, `ext_notifications_push_tokens`, `ext_chat_threads`, `ext_chat_messages`, `ext_billing_*`. First `ext sync` pins their versions after the baseline.
3. Update all references: hooks, API handlers, edge functions (`process-reminders` → `extensions/reminders/supabase/functions/reminders-process`, `stripe-webhook` → `extensions/billing/.../billing-stripe-webhook`), the Payload subscriptions-mirror webhook + user-tags logic, `tooling/rls-tests`, e2e specs. Regenerate `packages/api/src/types.ts` + the inlined migrations JSON + `packages/cms` types (collection slug renames produce cms-schema renames via a Payload migration).
4. **Existing-deploy note (documented in release notes):** this is a breaking restructure. Existing deploys must either reset (fresh DB) or run a provided one-off rename script (`alter table … rename to ext_…` + ledger repair — same precedent as the existing `repair_migration_ledger` Payload migration). The kit's own dev deploys are the only known instances.

### Refactor sequence (each step ends green: `pnpm typecheck && pnpm lint && pnpm test`)

> Checked = landed as a commit on `feat/extensions-framework` with the suite green.

- [x] **Phase 1 — Framework, zero extensions:** `packages/ext-kit`, `tooling/ext`, `extensions/*` in `pnpm-workspace.yaml`, empty generated registries + drift test, catch-all API route (dual cookie/Bearer auth), the `kit-extensions` + `nav-items` Payload collections + boot reconcile + CMS-driven sidebar/`useNavMenu()` (core entries only at this point), payload.config/env/seed/next.config wired to (empty) registries; extract `packages/ui-native` from `apps/expo/src/components`; add the static Tailwind/NativeWind `extensions/*` content globs; add the `expo export` smoke check to CI's integration job — proves the host wiring is inert and the native graph stays clean.
- [x] **Phase 2 — Resquash migration + table renames** (one commit, with the deploy note). *Implementation note: the four table-owning extensions (notifications, reminders, chat, billing) ship as package skeletons — manifest + `001_initial.sql` + `drop.sql` + edge functions — so their `ext_*` tables flow through `ext sync` from day one; their hooks/screens move in phases 3–7. CMS collection slug renames (`plans` → `ext-billing-plans` …) happen in phase 7 with the billing move, so the cms-schema rename ships in one Payload migration.*
- [x] **Phase 3 — `extensions/notifications`** first (it's the shared service others depend on): hooks/screens/push-test route, `notify()` service, HeaderBell gate. *Implementation notes: the web `NotificationBell` moved into the extension's `./web` exports and is rendered by the host header behind `hasExtension("notifications")` — app-shell chrome is the one host edit `ext remove` can't automate (commented in place). The generated Expo registry side-effect-imports each native extension's `./native` entry at app start so extensions can register boot handlers (the foreground push handler). `@acme/ui` gained `card`/`badge` (extension web screens consume the shared UI package). The header's section title now derives from the CMS-driven menu.*
- [x] **Phase 4 — `extensions/reminders`** (smallest dependent slice — proves `requires` + edge-fn contract). *Implementation notes: validator + hooks + `getUpcomingReminders` helper + unit tests moved into the extension (its vitest suite runs via root `pnpm test`); `@acme/ui` gained `select`; `/reminders` 301s to `/a/reminders`; the critical-path e2e spec exercises the generated stub.*
- [x] **Phase 5 — `extensions/chat`**: `/api/chat` → `routes["POST /stream"]`, both screen trees, hooks/validators. *Implementation notes: the route's hand-rolled auth + rate limiting fell away (the dispatcher owns both); the system prompt + history window moved into the kit's first §1.7 settings screen (`ext-chat-settings`, read via `getExtensionSettings` + `ctx.getPayload()`); the extension ships the kit's first extension-owned Payload migration (relocated from `migrate:create` output; the .json snapshot stays in the host dir for diff continuity — the §3.2 `payload-migrate` wrapper automates this in phase 8). `DEFAULT_AI_MODEL`/`AI_GATEWAY_API_KEY` stay core (golden rule #5). `/chat(/:id)` 301s to `/a/chat(/:id)`.*
- [x] **Phase 6 — `extensions/dashboard`**: mount overrides (`/a`, expo `index`), widget grid; other extensions gain their `widgets` exports. *Implementation notes: extensions can't import host registries, so widgets flow through a React context in the new `@acme/ext-kit/react` entry — each host layout wires its generated `extWidgets` (web filters runtime-disabled extensions server-side; native gates at the menu level for now). notifications/reminders/chat each gained web + native widgets. The plan card + checkout toast ride along in the dashboard until billing's widget takes them in phase 7.*
- [x] **Phase 7 — `extensions/billing`** (largest; needs the Payload globals/plugins merge): collections/global/plugin/hooks/seeds move, checkout/portal routes, webhook edge fn, `/pricing` public mount, `usePremium()` service. *Implementation notes: guest checkout required a framework addition — extensions may export `publicRoutes` (manifest `server.publicRoutes`), served by the dispatcher without a session but IP/user rate-limited; everything else stays authed-only. PricingSettings became billing's settings screen (`ext-billing-settings`, publicRead). The cms slug renames ship as billing's own relocated Payload migration (drop+recreate — covered by the phase-2 breaking note). Core couplings that reference billing collections (Users join, Enrollments/Series/Spaces plan relationships) carry delete-on-removal comments — billing is `system: true`. The pricing page became a self-contained extension RSC (Local API via a `@payload-config` module declaration); generated cms type names are aliased (`ExtBillingPlan as Plan`). `@acme/ext-kit/payload` now exports the standard access helpers. Stripe env vars stay in core config.*
- [x] **Phase 8 — Lifecycle + admin:** CLI add/update/remove/status, lock + snapshot refs, `extension-ops.yml`, admin Extensions view + ops/registry/upload API routes, `extension-uploads` bucket migration. *Implementation notes: sync also owns the apps' `@acme/ext-*` dependency entries and emits a bundled lock module for serverless reads. `ext create` ships a full working scaffold (inline templates rather than a templates/ dir). Proven: create demo → suite green → remove demo → drop migrations + tombstone, suite green; removing notifications refused while reminders requires it.*
- [x] **Phase 9 — Catalog + publishing (in-repo parts):** the admin store tab (Phase 8) reads `EXT_CATALOG_URL`; `docs/extension-catalog.example.json` is the catalog format to host in a registry repo; `ext eject` drops `tooling/ext/templates/extension-ci.yml` (tag/version validation + install-into-a-fresh-kit-clone gates) into ejected repos. *Deferred (needs repos beyond this one): creating the official `dream-extensions-catalog` registry repo and actually ejecting the five first-party extensions to their own GitHub repos — run `pnpm ext eject <slug> --repo <url>` per extension when those repos exist.*
- [x] **Phase 10 — Docs:** CLAUDE.md "How to add a modular feature" → extension recipe (reference = `extensions/reminders`); `docs/EXTENSIONS.md` (authoring, lifecycle, services pattern, trust model, founder setup: PAT + `EXT_OPS_TOKEN` + Allow auto-merge); ARCHITECTURE/ERD updated with the extension model + table renames (surgical notes; the per-table prose reads with the `ext_*` prefix applied); README deploy checklist gains the admin-ops setup.

---

## 9. Testing & CI integration

- **Unit:** free — extensions are workspace packages with `test` scripts; root `pnpm test` (turbo) discovers them. Registry drift test rides `@acme/nextjs`'s vitest run.
- **RLS:** extract the user-provisioning harness from `tooling/rls-tests/src/rls.test.ts` into `src/harness.ts` (exported as `@acme/rls-tests/harness`); core test shrinks to core tables; vitest include gains `../../extensions/*/tests/rls/**/*.test.ts`. `pnpm test:rls` unchanged.
- **E2E:** `tooling/web-e2e/playwright.config.ts` gains an `extensions` project (`testDir: ../../extensions`, `testMatch: **/tests/e2e/**/*.spec.ts`, depends on `setup`); helpers exported as `@acme/web-e2e/helpers`. The existing critical-path/subscription/pricing specs move with their features into the billing/chat/reminders extensions. `pnpm test:e2e` unchanged.
- **Native:** extension hooks/validators are exercised by the unit suite on both platforms' shared layer; `pnpm typecheck` covers `apps/expo` (it imports the native registries + stubs); the integration job gains an **`expo export` smoke check** so a server-only import leaking into the native bundle graph fails the PR.
- **CI:** `.github/workflows/ci.yml` is otherwise unchanged — the same root commands cover extensions. New file: `extension-ops.yml`.

---

## 10. Files to create / modify (summary)

**Create:** `packages/ext-kit/` (manifest types, `defineExtension`, `defineExtensionSettings` + `getExtensionSettings`/`useExtensionSettings`, server contract, pure validation logic + unit tests) · `packages/ui-native/` (`@acme/ui-native`, native primitives extracted from `apps/expo/src/components`) · `tooling/ext/` (sync/add/update/remove/status/create/eject/payload-migrate, merge engine, lock I/O, snapshot refs, `templates/**`) · `extensions/{dashboard,notifications,reminders,chat,billing}/**` · `extensions.lock` (root) + `extensions/.ext-lock.json` pins · `apps/nextjs/src/ext/*.generated.ts` + `registry-drift.test.ts` + `ext-packages.generated.json` · `apps/nextjs/src/app/api/ext/[ext]/[[...route]]/route.ts` · generated stub subtrees (both apps, incl. mounted `/a`, `/billing`, `/pricing`, expo `index`) · `apps/expo/src/ext/registry.generated.ts` · `apps/nextjs/src/payload/components/ExtensionsView.tsx` · `apps/nextjs/src/payload/collections/{KitExtensions,NavItems}.ts` + `apps/nextjs/src/lib/ext/reconcile-nav.ts` (CMS-driven menu, §2.5) · `useNavMenu()` hook + icon registry (in `packages/ext-kit` client + generated maps) · `apps/nextjs/src/app/api/extensions/{registry,ops,upload}/route.ts` · `.github/workflows/extension-ops.yml` · `tooling/rls-tests/src/harness.ts` · `docs/EXTENSIONS.md` · catalog registry repo (separate) · `extension-uploads` bucket migration.

**Modify:** `pnpm-workspace.yaml` (+`extensions/*`) · root `package.json` (ext scripts, version) · `packages/config` (env: `GITHUB_OPS_TOKEN`, `GITHUB_REPO`, `EXT_AUTO_MERGE`, `EXT_AUTO_UPDATE`, `EXT_CATALOG_URL`; `KIT_VERSION`) · `.env.example` (generated fence) · `app-sidebar.tsx`, expo `_layout.tsx` · `payload.config.ts` (collections/globals/plugins/prodMigrations merge, admin view; stripePlugin moves out to billing) · `payload/seed.ts` (core steps shrink; plans/coupons seeds move to billing) · `apps/nextjs/src/env.ts`, `apps/expo/src/lib/env.ts` · `next.config.js` (transpilePackages merge, redirects) · `packages/app/src/index.ts` (drop moved exports) + deleted moved files (use-premium, use-chat, use-reminders, use-notifications, reminder validator, dashboard/billing/pricing/chat/reminders/notifications screens in both apps, `/api/chat`, `/api/push/test`, `/api/stripe/*`) · `supabase/migrations/20260609000001_initial.sql` (resquash) · `supabase/functions/` (stripe-webhook + process-reminders move out) · `apps/expo` (components → `@acme/ui-native`, `lib/push.ts` → notifications extension, NativeWind content globs) · web Tailwind sources (`@source` globs for `extensions/*`) · `tooling/rls-tests/*`, `tooling/web-e2e/playwright.config.ts` · `tooling/eslint` (restricted imports + RN-safety rules for `.`/`./native` entries) · `.github/workflows/ci.yml` (one addition: `expo export` smoke check in the integration job) · CLAUDE.md, README, docs/.

**Known risks to verify early in implementation:** Metro package-exports subpath resolution on Expo SDK 54 (fallback: flat per-entry packages) · Payload `migrate:create` ergonomics for extension authors (mitigated by the wrapper command) · extension-provided Payload plugins interacting with `withPayload`/importMap generation (billing's stripePlugin is the proving case) · `requires`-based cross-extension DML is a documented contract, not DB-enforced · mount-override stub generation must stay compatible with the existing `(public)`/`(app)` layout groups and `proxy.ts` gating.

---

## Verification (when built)

1. Every refactor step: `pnpm typecheck && pnpm lint && pnpm test` green; `pnpm db:reset && pnpm db:gen-types && pnpm test:rls && pnpm test:e2e` green on the local stack — the existing e2e suite (sign-up → reminders → chat → pricing → subscription) proves the extensionized features behave identically (`/a`, `/billing`, `/pricing` keep their URLs via mounts; `/reminders` etc. redirect to `/a/…`).
2. Framework proof: `pnpm ext create demo` → sync → `db:reset` → the demo nav item, web+native screens, dashboard widget, `GET /api/ext/demo/ping` (authed via cookie on web and Bearer token from native), and RLS isolation test all work; `pnpm ext remove demo` leaves the suite green and generates the drop migration; removing `notifications` while `reminders` is installed is refused.
3. Native proof: `pnpm -F @acme/expo typecheck` green; `expo export` succeeds (no server-only code in the native graph); the Expo app in the simulator shows extension nav/home-screen entries, NativeWind-styled extension screens, and a native hook calling `/api/ext/…` with a Bearer token end-to-end (chat send, reminder create, push registration from the notifications extension).
4. Menu + settings proof: after installing `demo`, its menu item appears on web + native without any manual step (boot reconcile) and its settings screen appears under the **Extensions** admin group; in `/admin` → Nav Items, rename it, drag-reorder it, change its icon name, and toggle it off — web reflects the change without redeploy (revalidated tag) and native on next fetch; editing a settings field changes the sample route's behavior at runtime; disabling the extension in `kit-extensions` hides its nav item, 404s `/a/demo/*` and `/api/ext/demo/*`, and removes its dashboard widget; an extension update never clobbers the staff's renamed label/order/icon or saved settings.
5. Lifecycle proof: eject `demo` to a scratch GitHub repo → `pnpm ext add <url>` into a fresh kit clone → modify a vendored file locally → publish v1.0.1 upstream → `pnpm ext update demo` three-way merges cleanly; force an overlapping edit to confirm conflict markers + `--continue` flow.
6. Admin proof: with `GITHUB_OPS_TOKEN` set, install from the catalog, from URL, and from zip via `/admin/extensions` → workflow runs → PR opens with CI green → auto-merge → Vercel deploy → boot bootstrap applies `ext_*` migrations → boot reconcile adds the menu item → page shows Active. Scheduled run picks up a new upstream tag and auto-merges the update PR.
7. Drift tests guard the seams: stale registries, stale inlined-migrations JSON, and stale DB types each fail `pnpm test`.
