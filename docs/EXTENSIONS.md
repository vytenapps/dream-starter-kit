# Extensions

The kit is a host for **installable extensions**: vendored pnpm workspace
packages under `extensions/<slug>/` that own their tables, screens, API routes,
CMS collections and settings — installable with one command (or one click in
`/admin`), updatable from upstream even after local edits, and removable
without touching unrelated code. Design rationale lives in
`docs/EXTENSIONS-PLAN.md`; this is the working reference.

**The governing constraint:** Next.js and Expo are statically bundled and
serverless has a read-only filesystem. There is no runtime plugin loading —
*installing an extension means code lands in the git repo, CI gates it, the
deploy rolls, and the boot-time bootstrap applies migrations.* The framework
makes that pipeline feel like one click.

## The model in one paragraph

An extension is a workspace package with a typed manifest
(`extension.config.ts`, `defineExtension()` from `@acme/ext-kit`) and a strict
exports split that keeps server/Payload code out of the native bundle. The
host consumes extensions **only** through committed generated files produced by
`pnpm ext sync` (registries, route stubs, materialized migrations) — static
imports, no runtime discovery. Forgetting sync fails `pnpm test` via the
registry drift test. Provenance lives in `extensions.lock` + hidden
`refs/ext-base/<slug>` snapshot refs, which make updates a real git three-way
merge over your local modifications.

## Anatomy (the working reference is `extensions/reminders`)

```
extensions/<slug>/
  extension.config.ts      defineExtension({...}) — the manifest
  package.json             @acme/ext-<slug>; exports map below
  src/
    index.ts               CLIENT-SAFE barrel: validators + hooks (web+native)
    hooks/  validators/    zod/v4 + react-query over useSupabase()
    web/                   client components (@acme/ui); may import next/*
    web-server/            optional: RSC pages using the Payload Local API
    native/                react-native-reusables screens (@acme/ui-native)
    server/                import "server-only"; exports routes/publicRoutes
    payload/               collections, globals, plugins, migrations, seed, settings
  supabase/
    migrations/001_*.sql   LOCAL sequence numbers — never timestamps
    drop.sql               teardown for `ext remove`
    functions/<slug>-*/    optional Deno edge functions
  tests/                   vitest unit tests (run by root `pnpm test`)
```

### Bundle safety (the hard rules)

| Entry          | May import                                              | Guarded by |
| -------------- | -------------------------------------------------------- | ---------- |
| `.` (barrel)   | zod, react-query, `@acme/api`, `@acme/config`, `@acme/cms` types | RN-safe by construction; expo lint bans the rest |
| `./web`        | `@acme/ui`, next/* — **client-safe only**                 | the client registry imports it for widgets — server imports here leak into client chunks |
| `./web-server` | payload Local API, node — RSC pages (`rsc: true` routes)  | never imported client-side |
| `./native`     | `@acme/ui-native`, expo-*                                 | the only extension code Metro ever sees (plus `.`) |
| `./server`     | anything server-side; first line `import "server-only"`   | poison pill + dispatcher-only imports |
| `./payload`    | `payload`, `@acme/ext-kit/payload`                        | unreachable from clients |

The CI `expo export` smoke check is the backstop: a server import leaking into
the native graph fails the PR.

## Naming (collisions hard-fail `ext sync`)

| Thing | Rule | Example |
|---|---|---|
| slug / package | `^[a-z][a-z0-9-]{1,30}$` / `@acme/ext-<slug>` | `chat` |
| Supabase tables | `ext_<slug_snake>` or `ext_<slug_snake>_*`, RLS required | `ext_chat_threads` |
| Payload slugs | `ext-<slug>-*` (labels stay clean) | `ext-billing-plans` |
| Web routes | `/x/<slug>/…` default; validated `mount` overrides | billing mounts `/billing` |
| Server API | `/api/ext/<slug>/…` | `POST /api/ext/chat/stream` |
| Edge functions | `<slug>-*` | `reminders-process` |
| Env vars | `EXT_<SLUG>_*` (client keys get `NEXT_PUBLIC_`/`EXPO_PUBLIC_` added by codegen) | `EXT_CHAT_MAX_TOKENS` |

A best-effort SQL lint verifies migrations only DDL tables the manifest
declares and never touch `auth.*`/`storage.*`/role/grant DDL.

## How the host consumes extensions

`pnpm ext sync` (drift-tested, so commit its outputs):

- **registries** in `apps/nextjs/src/ext/*.generated.ts` +
  `apps/expo/src/ext/*.generated.ts`: nav defaults, widgets, icon map, server
  route tables, Payload collections/globals/plugins/migrations/seeds/settings,
  merged env shapes, the bundled lock;
- **route stubs**: two-line `page.tsx`/screen files under `/x/<slug>` (or the
  mount override), plus a per-extension `layout.tsx` that 404s when disabled;
- **migrations**: extension SQL is version-pinned (`extensions/.ext-lock.json`)
  and copied into `supabase/migrations/`; Payload migrations are copied into
  the host migrationDir (local CLI) *and* merged into `prodMigrations` (prod);
- **app deps**: `@acme/ext-<slug>` entries in both apps' package.json;
- the `.env.example` fenced block.

**Server API**: one dispatcher (`/api/ext/[ext]/[[...route]]`) authenticates
every call (session cookie on web, `Authorization: Bearer` on native), applies
the shared rate limit and the enablement gate, then matches `"METHOD /path"` in
the extension's `routes` table — golden rule #6 holds for every extension
endpoint with zero per-extension auth code. `publicRoutes` (manifest
`server.publicRoutes`) skips the session requirement for genuinely anonymous
flows (billing's guest checkout) but stays rate-limited; signature-verified
endpoints (Stripe webhooks) belong in edge functions or Payload plugin
endpoints instead.

**Menus are CMS-driven** (`kit-extensions` + `nav-items` collections,
Extensions admin group): manifest nav entries are *defaults*, seeded by the
boot reconcile (`lib/ext/reconcile-nav.ts`); staff rename/drag-reorder/re-icon/
toggle in `/admin` and the web sidebar + native `useNavMenu()` follow without a
redeploy. Disabling an extension in `kit-extensions` hides its menu items,
404s its pages and API, and removes its dashboard widgets — without
uninstalling.

**Settings screens** (§ per-extension config): export `settings =
defineExtensionSettings({ slug, name, fields })` from `./payload` and set
`cms.hasSettings: true`. The screen appears under the Extensions admin group
(versioned, staff-read/admin-update; `publicRead` for client-consumed toggles).
Server code reads it with `getExtensionSettings(payload, settings)` — defaults
apply before the screen is ever saved. Secrets stay in the zod env schema.

**Services** (cross-extension): declare `requires: ["notifications"]` and
import the provider's exported APIs directly — e.g.
`notify()` from `@acme/ext-notifications/server`, `usePremium()` from
`@acme/ext-billing`. `database.dml` whitelists DML on a dependency's tables
(or the tiny core whitelist: `tags`, `user_tags`) for edge functions that
follow the SQL contract.

**Widgets**: declare `widgets: { web, native }` (export names). The host wires
its generated widget registry through `@acme/ext-kit/react`'s
`ExtWidgetsProvider`; the dashboard extension renders `useExtWidgets()`.

## Lifecycle

```bash
pnpm ext create <slug>            # working scaffold (table+RLS, hooks, screens,
                                  #   widget, settings, ping route, tests)
pnpm ext add <url[#vX.Y.Z]|.zip>  # vendor + validate + snapshot + lock + sync
pnpm ext update <slug> [--to vX.Y.Z] [--continue]
pnpm ext remove <slug> [--keep-data]
pnpm ext list | status [--json] [--check]
pnpm ext eject <slug> --repo <url>
pnpm ext payload-migrate <slug> <desc>
pnpm ext sync                     # after ANY change under extensions/
```

Updates are a three-way merge (base = `refs/ext-base/<slug>` pinned in the
lock, ours = your possibly-modified copy, theirs = upstream) — local edits
survive clean updates; conflicts get standard markers + `--continue`.
`remove` refuses while another installed extension `requires` the target,
generates the drop migrations (Supabase + a best-effort cms scaffold), and
tombstones the lock (pinned migration versions are never reused).

## Admin panel + automatic updates

`/admin/extensions` lists installed extensions (from the **bundled** lock — an
honest "this deploy contains it" signal), the curated catalog
(`EXT_CATALOG_URL`, format: `docs/extension-catalog.example.json`),
install-from-GitHub and verified zip-upload forms, and live operations. Every
mutation dispatches `.github/workflows/extension-ops.yml`, which runs the same
CLI on a runner, enforces **path confinement** (the op may only write
`extensions/<slug>/**` + known sync outputs), and opens a labeled PR. A daily
schedule opens update PRs with auto-merge — CI green ⇒ merged ⇒ deployed ⇒
migrations at boot. Brakes: `EXT_AUTO_UPDATE=off` / `EXT_AUTO_MERGE=off`
(repo variables), per-extension `pinned` in the lock; removals never
auto-merge.

**Founder setup:** create a fine-grained PAT (contents:write,
pull-requests:write, actions:read on this repo); set it as the `EXT_OPS_TOKEN`
repo secret AND the `GITHUB_OPS_TOKEN` Vercel env (plus `GITHUB_REPO` off
Vercel); enable “Allow auto-merge” in the repo settings.

## Trust model (read before installing)

Installing an extension = trusting its author like an npm dependency: vendored
code runs server-side with env access and its SQL runs as the privileged
bootstrap role. No sandbox is claimed. The mitigations are review surface and
hygiene: everything is a PR (zip installs included), pre-PR validation
(manifest schema, namespacing, mounts, SQL lint, path confinement,
Payload-plugin flagging, the license gate, pnpm's install-script blocking),
the full CI on every PR, and documented GitHub hardening (branch protection +
fine-grained PAT). With auto-update on, extension authors can effectively ship
code to your server gated only by your CI — pinning and review mode are the
brakes.

## Versioning

`KIT_VERSION` (`@acme/config`, = root package.json version, unit-tested)
anchors `kitCompat` ranges, checked at add/update/sync. Extension version =
git tag = package.json (the template extension CI enforces it). Incompatible
after a kit upgrade = a warning state, not a kill switch — vendored code keeps
running until updated.
