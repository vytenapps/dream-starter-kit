# CLAUDE.md — working agreement for this repo

Guidance for Claude Code (and humans) extending the **Dream Starter Kit**.
Read this first, then `docs/ARCHITECTURE.md` and `docs/ERD.md` — those two are the
**source of truth**. If anything here conflicts with them, they win.
(`docs/CMS.md` is the per-collection CMS reference — keep it in sync when you
touch Payload collections; `docs/EXTENSIONS.md` is the extension framework
reference.)

## What this is

A clone-and-ship starter: one Turborepo monorepo that ships a **Next.js web app**
and an **Expo (iOS + Android) app** sharing **one Supabase backend**. A founder
clones it and extends it (with you) into a real product. So: keep it
**runnable end-to-end**, **clean**, and **well-documented**. Correctness and
clarity beat cleverness.

## Stack (and where each lives)

| Concern                               | Choice                                                                            | Location                                  |
| ------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------- |
| Monorepo                              | Turborepo + pnpm (forked from create-t3-turbo)                                    | root                                      |
| Web                                   | Next.js (App Router), shadcn/ui, Tailwind                                         | `apps/nextjs`                             |
| Mobile                                | Expo + Expo Router, react-native-reusables, NativeWind                            | `apps/expo`                               |
| Backend                               | Supabase: Postgres + Auth + Storage + Edge Functions                              | `supabase/`                               |
| Content / CMS                         | Payload CMS v3 (web/server only) — own `cms` schema, `/admin`, REST at `/cms-api` | `apps/nextjs/src/payload`, `packages/cms` |
| Data layer (client + generated types) | `@supabase/supabase-js` typed client, session provider                            | `packages/api`                            |
| Shared features                       | cross-platform validators, react-query hooks, logic                               | `packages/app`                            |
| Shared UI tokens / primitives         |                                                                                   | `packages/ui`                             |
| Env + constants                       | zod env schema, `DEFAULT_AI_MODEL`, etc.                                          | `packages/config`                         |
| Payments                              | Stripe (web only) + webhook edge function                                         | `apps/nextjs`, `supabase/functions`       |
| AI                                    | Vercel AI SDK v6 via the AI Gateway (Claude default)                              | server routes / edge fn                   |
| Build/ship                            | EAS (mobile), Vercel (web), Expo Push                                             | `eas.json`, Vercel                        |

> Package scope is `@acme/*` (inherited from the template). It's renameable —
> see the README. Don't rename mid-build.

## The golden rules (do not violate)

1. **RLS on every app table.** Authorization for `public` lives in Postgres, not app
   code. Every table in the `public` schema has an owner (`user_id`/`owner_id`, or
   reachable via `memberships`) and policies scoped to `(select auth.uid())`. See
   `docs/ERD.md`. **The one allowed exception is Payload CMS**, which owns the
   separate `cms` schema and enforces its own **role-based access rules** — content
   AND member-engagement data (profiles, favorites, comments, enrollments, the
   `subscriptions` mirror) live there governed by Payload access control, contained
   via a dedicated least-privilege, server-only `payload_cms` role (no access to
   `public`/`auth`; provisioned automatically at server boot in production by
   `apps/nextjs/src/lib/db/bootstrap.ts`, locally by `00_cms_role.sql`). Note the
   CMS API bridge is **staff-only today** — members reach
   their CMS-side data through your own server routes until the member-auth
   follow-up ships. Security-critical per-user state that RLS clients consume
   directly (auth, chat, reminders, billing entitlements in `public.subscriptions`)
   stays in `public` under RLS.
2. **Service role key is server-only.** It bypasses RLS. It appears ONLY in
   Supabase edge functions / server code (e.g. the Stripe webhook). Never in
   `apps/expo` or web client code.
3. **Secrets via the zod env schema.** No hardcoded keys. Add new vars to
   `.env.example` AND `packages/config/env`, split correctly:
   - `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` = public (compiled into the client). Only
     anon/publishable values.
   - everything else = server-only.
     The app must fail loudly if a required var is missing.
4. **Stripe is web-only.** No StoreKit / Play Billing / IAP. Mobile unlocks
   premium by reading the `subscriptions` table (RLS read-own).
5. **AI model id is centralized & swappable.** Use `DEFAULT_AI_MODEL` from
   `packages/config`; don't hardcode slugs elsewhere. Resolve available models
   at runtime where practical.
6. **AI routes are authed, rate-limited, token-capped.** Never expose the
   gateway to anonymous traffic.
7. **Cross-platform code lives in `packages/`; `apps/*` are thin entry points.**

## Commands

```bash
pnpm install            # install workspace
pnpm dev                # run all apps (turbo watch)
pnpm dev:next           # web only
pnpm typecheck          # tsc across the workspace  <- run before commit
pnpm lint               # eslint across the workspace <- run before commit
pnpm format:fix         # prettier write

# Supabase (local dev)
supabase start          # boot local Postgres/Auth/Storage (Docker)
supabase db reset       # re-apply migrations + seed.sql
supabase status         # show local URLs + keys
pnpm db:gen-migrations  # re-inline supabase/migrations into the web bundle for the
                        #   runtime DB bootstrap — run after adding a migration and
                        #   commit the JSON (drift fails `pnpm test`)

# Extensions (see docs/EXTENSIONS.md)
pnpm ext sync           # regenerate registries/stubs/migrations from extensions/*
pnpm ext create <slug>  # scaffold a new extension (then: install, db:reset, gen-types)
pnpm ext add|update|remove|status  # lifecycle (vendored + lock + snapshot refs)

# Tests
pnpm test               # vitest (unit/integration) — no backend needed
pnpm test:e2e           # Playwright (web E2E). Needs `supabase start` + `supabase db
                        #   reset` + .env on local Supabase; boots `next dev` itself.
                        #   See tooling/web-e2e/README.md.
pnpm test:rls           # RLS isolation regression. Needs `supabase start` + .env with
                        #   NEXT_PUBLIC_SUPABASE_URL/ANON_KEY + SUPABASE_SERVICE_ROLE_KEY.
pnpm license:check      # fail on strong copyleft (GPL/AGPL/SSPL) in the prod tree
```

CI (`.github/workflows/ci.yml`) runs all of these on every PR: lint · format ·
typecheck · unit · license, plus an `integration` job that boots Supabase and runs
`test:rls` + Playwright.

## Cloud sessions (Claude Code on the web)

Cloud session containers start bare: no Docker daemon, no Supabase CLI, no `.env`.
The **SessionStart hook** (`.claude/hooks/session-start.sh`, registered in
`.claude/settings.json`, cloud-only via `$CLAUDE_CODE_REMOTE`) bootstraps the full
local stack automatically: it starts `dockerd`, installs the Supabase CLI,
`pnpm install`s, boots Supabase, writes `.env` from `.env.example` with the local
keys + a generated `PAYLOAD_SECRET`, runs `pnpm db:reset`, and installs
**Playwright's Chromium** (`playwright install chromium`, cached in
`$PLAYWRIGHT_BROWSERS_PATH`). Every step is idempotent, so resumed sessions are
fast. Don't re-do these steps by hand — if the stack seems down, just rerun the hook.

Cloud-session quirks:

- **`supabase start` must exclude edge-runtime** (`-x edge-runtime`): that container
  sets rlimits the sandboxed nested-container runtime forbids. Edge functions
  (Stripe webhook, `reminders-process`) don't run in cloud sessions.
- **Unset optional env vars must be absent, not `""`** — empty strings fail the zod
  schema's `min(1)` checks. The hook comments them out when generating `.env`.
- The hook does **not** start the dev server. Use the `web` configuration in
  `.claude/launch.json` (the cloud preview browser) or `pnpm dev:next`.
- Local URLs: app :3000 · Supabase API :54321 · Studio :54323 · Mailpit :54324
  (sign-up confirmation emails land in Mailpit).

### Testing in cloud sessions (full suite works)

The hook leaves the stack + `.env` exactly the way the test suites expect, so run
the **full** test matrix, same commands as local:

- `pnpm test` — vitest unit/integration (no backend needed).
- `pnpm test:rls` — RLS isolation (Supabase is already up; `.env` already has the
  anon + service-role keys).
- `pnpm test:e2e` — Playwright web E2E. Chromium is pre-installed by the hook;
  Playwright boots `next dev` itself (or reuses one already running on :3000).
  Auth flows pull confirmation links/codes from Mailpit (see
  `tooling/web-e2e/README.md`). The founder/first-user flow needs a **fresh DB** —
  run `pnpm db:reset` first if users were created since the hook ran.
- Out of scope in cloud sessions: anything needing edge functions (Stripe webhook,
  `reminders-process`) and `expo` device builds.

**Visual testing:** the desktop Preview pane is local/SSH-only — in cloud sessions
it is greyed out and there is no embedded browser. Verify UI changes by driving the
app with the pre-installed Playwright Chromium instead: write a throwaway script
(import `chromium` from `@playwright/test`, run it from `tooling/web-e2e/` so the
package resolves), navigate, `page.screenshot(...)`, and **send the screenshots to
the user** so they can see each step. Clean up throwaway scripts before committing.

## How to add a feature: build an extension

Features are **extensions** (docs/EXTENSIONS.md is the working reference;
docs/EXTENSIONS-PLAN.md the design). An extension is a vendored workspace
package at `extensions/<slug>/` that owns its tables (`ext_<slug>_*`, RLS
required), validators + hooks (client barrel, shared web + native), screens
(`./web`, `./native` — RSC pages in `./web-server`), API routes (`./server`,
served authed + rate-limited at `/api/ext/<slug>/…`), Payload
collections/settings (`./payload`), edge functions, and tests. The in-repo
reference is **`extensions/reminders`**; the five first-party features
(dashboard, notifications, reminders, chat, billing) are all built this way.

```bash
pnpm ext create <slug>   # working scaffold: table+RLS, hooks, both screens,
                         #   widget, settings screen, authed ping route, tests
pnpm ext sync            # after ANY change under extensions/ — regenerates
                         #   registries/stubs/migrations; drift fails pnpm test
pnpm ext add|update|remove|status|eject|payload-migrate   # lifecycle (§docs)
```

Rules that keep extensions modular:

- **The host consumes extensions only through generated files** — never import
  `@acme/ext-*` from host code outside the generated registries (the two
  documented exceptions, the header bells, carry delete-on-removal comments).
- **Bundle safety:** the client barrel (`.`) and `./native` are the only
  entries Metro may see; `./web` must stay client-safe (widgets are imported
  from it); server-only code lives behind `import "server-only"` /
  `./payload` / `./web-server`. ESLint + the CI `expo export` smoke check
  enforce this.
- **Migrations:** local sequence numbers (`001_initial.sql`) inside the
  extension; `ext sync` pins versions and materializes copies — never edit a
  synced migration, add a new one. Ship a `drop.sql` for clean removal.
- **Nav is CMS-driven:** manifest `nav` entries are defaults seeded into the
  `nav-items` collection; staff own the menu in /admin afterwards.
- **Cross-extension access** is declared: `requires: [...]` + `database.dml`
  whitelists; services are plain typed package exports (`notify()`,
  `usePremium()`).
- After schema/CMS changes: `pnpm db:reset && pnpm db:gen-types`
  (+ `pnpm cms:gen-types`), commit the regenerated files.

## How to add a Payload content type

For **content and member engagement** (anything that isn't security-critical
RLS-client state), add a **Payload collection**, not a Supabase table. The CMS ships
a full registry across five admin groups — **Content** (posts, videos incl. vertical
shorts, audio/podcast episodes, photos, series/courses + lessons, locations, events,
categories/tags), **Community** (space-groups → community-spaces → community-posts,
one threaded `comments` system, a `reports` moderation queue), **People** (users,
device-tokens, feed-tokens, favorites, enrollments, reviews), **Commerce**
(plans/coupons/subscriptions) and **Marketing** (pages, onboarding, banners,
notifications, forms). Collections live in the `cms` schema and are governed by
**Payload's role-based access-control, not RLS** (`payload/access/index.ts`:
`isAdmin`/`isStaff`/`publishedOrStaff`/`ownsOrStaff`…; owner-scoped collections force
the owner on create via `payload/hooks/assign-owner.ts`).

1. **Collection.** Add a config in `apps/nextjs/src/payload/collections/` (copy
   `Posts.ts` for editorial content, `Favorites.ts` for owner-scoped member data).
   Set fields, `slug`, `admin.group`, and `access` (e.g. `publishedOrStaff` reads).
   Reusable field helpers live in `payload/fields/` (slug, link, accessLevel,
   commentsEnabled, destination).
2. **Register it** in `apps/nextjs/src/payload.config.ts` (`collections: [...]`).
3. **Types.** `pnpm cms:gen-types` regenerates Payload's types into `packages/cms`
   (`@acme/cms`) — never hand-edit. Then `pnpm cms:migrate:create` to generate a migration
   under `apps/nextjs/src/payload/migrations` (generated — never hand-edit) and **commit
   it**. Locally, dev-push (or `pnpm db:reset`, which now runs `cms:migrate`) applies it;
   in production Payload runs committed migrations automatically on first boot via the
   adapter's `prodMigrations`, so no manual `cms:migrate` deploy step is needed.
4. **Web page.** Add a public RSC route under `apps/nextjs/src/app/(frontend)/(public)/`
   that fetches via Payload's **Local API** (`getPayload(...).find(...)`), for SEO.
5. **Mobile.** Add a REST hook in `packages/app` (copy `use-content.ts`'s
   `usePosts`/`useEvents`), typed by `@acme/cms`, and a native screen under
   `apps/expo/src/app/(app)/content/`.
6. **No RLS, no rls-tests.** Content is access-controlled by Payload — do **not**
   add it to `docs/ERD.md` or `tooling/rls-tests`. (Add a Playwright `content.spec.ts`
   case if it's a critical public flow.)
7. **Seed it.** Add a demo row for the new collection to `seedCmsContent()` in
   `apps/nextjs/src/payload/seed.ts` (as a new ordered step) so the CMS stays "fully
   functional" out of the box. That seed runs three ways: the `pnpm cms:seed` CLI;
   automatically right after the **founder's account is created** — sign-up routes the
   first/staff user through `/welcome` (`app/welcome/route.ts`) to `/cms-setup`, which
   streams `/api/cms/seed` behind a shadcn progress bar, then enters `/admin`; and, as a
   fallback, the first time a staff user opens an unseeded `/admin` — a `beforeDashboard`
   gate (`payload/components/SeedGate.tsx`) redirects them to the same `/cms-setup` flow.
   All paths share one idempotent endpoint. Keep steps scalar-only (no binary fixtures).

**CMS auth is SSO from Supabase — there is no second login.** Payload's local strategy
is disabled; `apps/nextjs/src/payload/auth/supabase-strategy.ts` authenticates each CMS
request from the Supabase session and provisions a `cms.users` row (linked by
`supabaseUserId`). Users carry **`roles[]`** (`admin`/`editor`/`author`/`member`,
WordPress-style): every app signup is mirrored in as a `member`
(`lib/cms/mirror-user.ts`); staff get admin/editor and may enter `/admin`. Access is
**default-deny**: only users with `profiles.is_staff = true` get in — **the bridge
authenticates staff only for now**; member-scoped collections carry correct
owner-scoped access rules, but opening `/cms-api` to member sessions is a documented
follow-up. The first signup is auto-flagged (and JIT-provisioned `admin`); further
staff are **invited from `/admin` → Users → Create New** — a collection hook
(`payload/hooks/invite-user.ts`) emails a Supabase invite and flags `is_staff` via
the service-role client (`lib/supabase/admin.ts`, server-only — the pattern golden
rule #2 allows); the invitee sets a password on `/accept-invite`. Users are
soft-deleted (`trash: true`): the bridge rejects trashed rows and the mirror won't
resurrect them — restore from the admin Trash view. The bridge itself runs in the
Next.js server — it reads `profiles` via the user's own RLS session and writes
`cms.users` via the Local API — so it never uses the `payload_cms` DB role or the
service-role key (golden rules #1–2 hold). `/admin` is gated in `proxy.ts`.

**Sign-up requires email confirmation** (`enable_confirmations = true` locally, matching
hosted Supabase): the form routes to `/check-email`, which offers the emailed link
(→ `/confirm-email`, which verifies the `token_hash` and forwards to `/welcome`) or
manual entry of the emailed 6-digit code (`verifyOtp`). Both kit email templates
(`supabase/templates/`) link via `token_hash` pages — never GoTrue's redirect-style
links, whose one-time tokens break for re-sent emails (no PKCE state) and get burned
by prefetchers/navigation restarts. E2E specs pull link + code from Mailpit — see
`tooling/web-e2e/README.md`.

## Payments (Payload ⇄ Stripe via @payloadcms/plugin-stripe)

The billing catalog is **authored in Payload**, not the Stripe dashboard. `Plans`,
`Coupons` and the read-only `Subscriptions` mirror live under the **Commerce** admin nav
group (`apps/nextjs/src/payload/collections/`), and `PricingSettings` (a global) curates
the public `/pricing` page (which ≤3 plans to feature + a Free tier). The default three
plans (Dream Monthly/Annual/Lifetime) + a welcome coupon are seeded by `seedCmsContent()`.

- **Payload → Stripe is automatic**: saving a plan/coupon runs an `afterChange` hook
  (`payload/hooks/sync-plan-to-stripe.ts` / `sync-coupon-to-stripe.ts` →
  `lib/stripe/sync.ts`). It creates/updates the Stripe product and **creates a new price +
  archives the old one** whenever the amount/interval changes (Stripe prices are
  **immutable** — never mutate, always recreate). Coupons follow the same
  recreate-on-change rule. A per-doc `skipSync` checkbox opts out; failures land on
  `syncStatus`/`syncError` instead of failing the save; the seed skips the hook
  (`context.skipStripeSync`), so seeded plans stay `unsynced` until first saved.
- **Stripe → Payload** runs through `@payloadcms/plugin-stripe`'s signature-verified
  webhook endpoint (`POST /cms-api/stripe/webhooks`, secret
  `STRIPE_WEBHOOKS_ENDPOINT_SECRET`): `customer.subscription.*` events upsert the
  read-only CMS `subscriptions` collection (`payload/stripe/webhooks.ts`; user resolved
  via `public.customers`, plan via `stripePriceId`). The plugin's Stripe REST proxy is
  **off** (`rest: false`) and its declarative sync is unused (it can't express price
  immutability/intro coupons). The **edge-function webhook** (separate Stripe endpoint,
  `STRIPE_WEBHOOK_SECRET`) keeps mirroring products/prices/subscriptions into `public.*`
  for RLS clients — unchanged.
- **Intro offers** ("$1.99 first month, then $39.99") = a coupon auto-applied at checkout
  (`once` for one intro period, `repeating` for several; years × 12 → Stripe
  `duration_in_months`). **Repeating** coupons take N months _or_ N years the same way.
- **Checkout is plan-driven** (`/api/stripe/checkout` takes a Payload `planId`) and supports
  **guest checkout**: an anonymous buyer pays first, then the webhook matches their email to an
  existing account or creates one + emails a Supabase invite (`/accept-invite` → `/a`).
  Stripe stays **web-only** (golden rule #4); mobile shows a read-only `/pricing` and links out.
- Self-serve billing lives at `/billing` (current plan, change/cancel via the Stripe portal, past
  invoices). Free→paid upgrade CTA is on `/a` (the app home).
- E2E: `tooling/web-e2e/src/subscription.spec.ts` covers the webhook mirror with
  self-signed events and (when a test-mode `STRIPE_SECRET_KEY` is set) real Checkout
  subscription creation — authenticated + guest — with Stripe's 4242 test card.

**User tags** (`public.tags` / `public.user_tags`, RLS read-own) tag each user by plan name (the
webhook auto-tags on active subscription; "Free" at signup) and are staff-manageable from the
Payload **Users** page — which now mirrors **all** Supabase users (see `lib/cms/mirror-user.ts`;
`profiles.is_staff` still gates admin login). Tags show on the app `/profile` (web + native).

## Remote MCP server (`@acme/mcp`)

The web app hosts a **remote MCP server** so a workspace admin can connect an MCP client
(Claude, ChatGPT, Cursor, …) and manage CMS content + push notifications in natural
language. It's **core, not an extension** — MCP clients discover auth at domain-root paths
(`/.well-known/oauth-*`) and connect to `/mcp`, which extensions (mounted under
`/api/ext/<slug>`) can't serve. All logic lives in the server-only package **`packages/mcp`
(`@acme/mcp`)**; thin Next.js route handlers wire it in and **inject** Payload + the
service-role client, so the package stays framework-agnostic and unit-testable (and never
enters the Expo bundle). It's **gated by `MCP_JWT_SECRET`** (`isMcpConfigured`/`isMcpEnabled`,

- an `MCP_ENABLED` kill switch) — the whole surface 404s until set.

* **Auth = OAuth 2.1 browser login** (MCP authorization spec). The app is its own OAuth 2.1
  authorization server: `/.well-known/oauth-protected-resource` + `/.well-known/oauth-authorization-server`
  discovery, dynamic client registration (`/oauth/register`), and PKCE (S256-only)
  `/oauth/authorize` + `/oauth/token`. **`/oauth/authorize` reuses the existing Supabase
  `/sign-in`** (redirects anonymous users there with itself as `redirectTo`) and gates on
  `profiles.is_staff` — signing in IS the consent, there's no second login UI. Access tokens
  are stateless **HS256 JWTs** (verified with `MCP_JWT_SECRET`, no DB hit); refresh tokens are
  opaque, hashed, and **rotate with reuse detection**. OAuth state lives in three **server-only,
  deny-all-RLS** `public.mcp_oauth_*` tables (see `docs/ERD.md`). `proxy.ts` bypasses session
  refresh for the bearer/DCR endpoints (`/mcp`, `/.well-known/oauth-`, `/oauth/register`,
  `/oauth/token`); `/oauth/authorize` flows through normally so it can read the session.
* **Transport:** the MCP SDK's **Web-standard Streamable HTTP transport, stateless**
  (`@modelcontextprotocol/sdk` — no `mcp-handler`), so a Next.js `Request` maps straight to a
  `Response` with no session store. `/mcp` verifies the bearer token, resolves the staff
  `cms.users` row, and runs **every tool through the Payload Local API as that user with
  `overrideAccess: false`** — so role-based access control is enforced exactly as in `/admin`.
  A missing/invalid token returns `401` with the `WWW-Authenticate` header that kicks off the
  client's OAuth flow (mandatory — don't drop it).
* **Tools:** `list_collections`, `search_content`, `read_content`, `create_content`,
  `update_content`, `delete_content` over an **allowlist** of editorial/community/marketing
  collections (`tools/registry.ts` — auth/PII collections excluded); `notify_create` /
  `notify_schedule` / `notify_list` / `notify_cancel`; and ChatGPT-compatible **`search` +
  `fetch`** (ids are `collection:id`). To expose another collection, add it to
  `MCP_COLLECTIONS`.
* **Notification delivery:** `notify_schedule` writes a `scheduled` Payload `notification`; the
  **dispatch worker** (`/api/cms/notifications/dispatch`, `CRON_SECRET`-guarded, Vercel Cron —
  `apps/nextjs/vercel.json`) sends it. See `docs/CMS.md` → `notifications`.
* **Don't hardcode the origin** — absolute URLs (issuer/resource/metadata) come from
  `getSiteUrl()`. Tests: pure logic (pkce/tokens/oauth flow), an in-memory MCP client↔server
  tool test against a fake Payload, and the dispatch worker all run under `pnpm test` (no
  backend); the OAuth dance + a live MCP `tools/call` are Playwright/e2e against `next dev`.

## Theming (shadcn, one source of truth)

The **front end** is driven by one editable shadcn theme; the Payload `/admin` panel
uses its own **fixed** palette (Tailwind v4, OKLCH tokens). Layers:

1. **Static defaults (no-flash):** all design tokens live in **`tooling/tailwind/theme.css`**
   (`@acme/tailwind-config/theme`) — `:root` + `@variant dark`, plus the `@theme inline`
   map. This is the _only_ place tokens are defined. **Do not** redefine `:root`/`.dark`
   tokens in `apps/nextjs/src/app/styles.css` (it only holds imports, variants, base layer).
2. **Front-end runtime override (site-wide, editable):** the **`theme-settings` Payload global**
   (`payload/globals/ThemeSettings.ts`, staff-editable in `/admin`) is the authoritative
   **front-end** theme. `lib/theme/serialize.ts#themeToCss` turns it into a `<style>` that
   overrides the defaults (doubled `:root:root` selector wins regardless of `<head>` order),
   targeting `.dark` (front end). It's injected server-side by `<ThemeStyle />` (front-end
   layout `<head>`). Defaults live in `lib/theme/defaults.ts` and **must mirror `theme.css`**.
3. **Admin fixed theme:** the `/admin` panel is pinned to a hardcoded palette in
   **`lib/theme/admin-theme.ts`** (`ADMIN_THEME_CSS`), injected by `ThemeStyleProvider`
   (registered as Payload `admin.components.providers`). It is intentionally independent of
   the `theme-settings` global, so editing the front-end theme never changes the admin chrome.
   The dark block targets `[data-theme="dark"]` (the selector the admin toggles). To restyle
   the admin, edit the token values in that file.

The shared **app shell** (shadcn `dashboard-01`) wraps every authenticated page in
`app/(frontend)/(app)/layout.tsx` (sidebar + header); pages return content only.

**To add/change a color token:** edit `theme.css` (default) **and** `lib/theme/defaults.ts`
(`COLOR_TOKENS`, which also generates the global's fields + serializer output) — never in
`styles.css`. Fonts are a curated `next/font` set chosen at runtime via the global
(`FONT_*_OPTIONS`); their CSS vars are set on `<html>`.

**Payload admin** follows Payload's official Tailwind+shadcn guide: `(payload)/custom.css`
pulls in Tailwind **utilities without preflight** (so shadcn components work in admin
without breaking Payload's reset) and maps the shadcn tokens onto Payload's own
`--theme-*`/`--font-body` chrome variables. Token values come from `ThemeStyleProvider`
(the fixed `admin-theme.ts` palette, not the editable global).

**Editing the theme.** `theme-settings` is a **standard, versioned Payload global** — no
custom view. It lives in the **Admin** nav group under **Site Settings** and is edited with
Payload's native **Edit / API** tabs plus a **Versions** tab. Versioning is **drafts → publish**
(`versions: { drafts: true }`): the front end renders the **published** theme, so a draft save
does not change the live site until you **Publish** (the admin chrome is unaffected either way —
it uses the fixed `admin-theme.ts` palette). Fields are grouped in tabs
(Branding · Light · Dark · Typography · Other); branding uploads (app icon/logos) use standard
Media upload fields. Read access is `publishedOrStaff` (anonymous visitors get the published
theme; staff see drafts); update + `readVersions` are staff-only. Pure color math lives in
`lib/theme/color.ts` (consumed by `serialize.ts`). **Branding** (app name, favicon, sidebar logo)
is read server-side by `getBranding()` (lib/payload.ts) and surfaced via `BrandingProvider`.
Serif fonts (Merriweather/Lora) are loaded on `<html>` alongside the sans/mono set.

## Conventions

- **TypeScript everywhere**, `strict`. No `any` without a reason.
- **Payload hooks/validates: always pass `req`** to nested Local API calls
  (`req.payload.find({ ..., req })`). A req-less call runs outside the
  operation's transaction and checks out a second pool connection — with the
  small serverless pool that can deadlock saves (300s 504s on Vercel).
- **Commits:** Conventional Commits, one per phase/feature
  (`feat(backend): ...`, `fix(auth): ...`).
- **Keep it buildable.** typecheck + lint must pass at every checkpoint.
- **Env changes** always touch both `.env.example` and the zod schema.
- **Migrations are append-only and idempotent-friendly.** Never edit a shipped
  migration; add a new one.
- **Don't track create-t3-turbo upstream** (see `docs/ARCHITECTURE.md` → Keeping
  dependencies current): snapshot + cherry-pick only. The forked SHA is in `NOTICE`.

## Staying current with the kit (upstream sync)

When this repo is a **fork/clone of the kit** and you're asked to "sync with
upstream", "pull in kit updates", or "merge upstream", run the tested routine
(full guide: `docs/UPDATING.md`). The whole flow depends on **sharing git history**
with the kit, so the cardinal rule is: keep the merge commits, never squash them.

- **Remote.** The named remote is `upstream`
  (`git remote add upstream https://github.com/vytenapps/dream-starter-kit.git`);
  add it if missing, then `git fetch upstream`.
- **Detect the starting situation:** `git merge-base <yourmain> upstream/main`.
  Resolves → shared history (GitHub "Fork"), merge normally. Empty/non-zero →
  unrelated history ("Use this template", or re-init'd/squashed-snapshot repos);
  fix it **once** with `git merge upstream/main --allow-unrelated-histories`
  (nearly conflict-free where the tree already matches upstream — identical files
  merge cleanly against the empty base), resolve, commit. After that one merge,
  `upstream/main` is a real ancestor and every later update is a plain three-way merge.
- **The routine (every update):** `git fetch upstream` → branch off main
  (`git checkout -b sync/upstream-YYYY-MM-DD`) → `git merge upstream/main` → resolve →
  `pnpm install && pnpm typecheck && pnpm lint && pnpm test` → open a PR into main.
- **NEVER squash a sync PR** — land it with a merge commit or rebase/fast-forward.
  Squashing flattens the merge commit that records `upstream/main` as an ancestor,
  re-breaking the relationship and forcing `--allow-unrelated-histories` next time.
- **Conflict hotspots:** generated files (`packages/cms/src/payload-types.ts` →
  `pnpm cms:gen-types`; Supabase types → `pnpm db:gen-types`) — take either side
  then **regenerate**, don't hand-merge; `payload-types.ts` also shows phantom
  quote/`SupportedTimezones` churn after a generate — discard it
  (`git checkout -- <file>`). Migrations are append-only — keep **both** sides'
  files, then `pnpm db:reset` (+ `pnpm db:gen-migrations` if the bundle JSON drifts).
  Env: reconcile both `.env.example` and the zod schema. `pnpm-lock.yaml`: re-run
  `pnpm install`, don't hand-merge.
- **Intentional divergence** (branding, your CI, README): pin with `.gitattributes`
  (`path/** merge=ours`) + `git config merge.ours.driver true` (per-clone, not
  committed). `merge=ours` doesn't cover modify/delete — re-delete those.
- **Single urgent fix without a full sync:** `git fetch upstream` then
  `git cherry-pick <sha>` (patch-based — works across unrelated histories).
- **Post-merge:** `pnpm install`, `pnpm db:reset`, regenerate types, then the gates
  (`pnpm typecheck && pnpm lint && pnpm test`, plus `pnpm test:rls` if schema/RLS
  changed). Commit `docs:`/`chore:`, branch off main, PR with what & why.

## Status

The kit is **feature-complete and ready to clone** — and is now an **extension
host** (docs/EXTENSIONS.md): auth, the CMS registry, theming and the app shell
are core; dashboard, notifications, reminders, chat and billing ship as
pre-installed extensions under `extensions/` with the full lifecycle
(create/add/update/remove, CMS-driven menus, per-extension settings screens,
the /admin/extensions panel + extension-ops workflow). The test/CI suite is
green end to end. Known follow-ups: opening the CMS API bridge to member
sessions; publishing the five first-party extensions to their own repos +
the official catalog repo (`pnpm ext eject`); per-extension RLS test
relocation (the central suite still covers all tables). Extend the kit with
`pnpm ext create`, keep every checkpoint green
(`pnpm typecheck && pnpm lint && pnpm test`), and update this file when
conventions change.
