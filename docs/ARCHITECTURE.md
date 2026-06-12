# Dream Starter Kit — Architecture

> One monorepo → a **Next.js web app** and an **Expo (iOS + Android) app** that
> share **one Supabase backend**. This document explains how the pieces fit
> together, as the kit is actually built.
>
> **License:** Apache-2.0 — see [`LICENSE`](../LICENSE) and [`NOTICE`](../NOTICE).
> **Data model:** see [`ERD.md`](./ERD.md). **CMS collections & fields:** [`CMS.md`](./CMS.md).
> **Conventions & recipes:** [`CLAUDE.md`](../CLAUDE.md).

---

## 1. What this is (in plain terms)

A founder clones this repo and gets a working product skeleton for web **and**
mobile that already handles the boring-but-essential parts: sign-up/login,
a database with per-user security, subscriptions, an AI assistant, push
notifications, and a **content/marketing CMS**. You add your own features and ship.

Two ideas make it maintainable:

1. **Write shared logic once.** Validation, data access, and feature logic live
   in `packages/` and are used by both the web and mobile apps. The apps
   themselves are thin — mostly screens and platform UI.
2. **Security lives in the database.** Every table enforces "you can only see and
   change your own rows" with Postgres **Row-Level Security (RLS)** — not in app
   code that's easy to get wrong.

---

## 2. Stack at a glance

| Layer | Choice |
|---|---|
| Monorepo / build | Turborepo + pnpm (one catalog pins every version) |
| Web app | Next.js (App Router) + shadcn/ui + Tailwind CSS |
| Mobile app | Expo + Expo Router + react-native-reusables + NativeWind |
| Backend | Supabase — Postgres, Auth, Storage, Edge Functions (Deno) |
| Authorization | Postgres **Row-Level Security** on every app table |
| Data layer | `@supabase/supabase-js` typed client + react-query hooks |
| Content / CMS | **Payload CMS v3** (web/server only) — own `cms` schema, admin at `/admin`, REST at `/cms-api` |
| Payments | Stripe (web subscriptions) + a webhook edge function |
| AI | Vercel AI SDK v6 through the **Vercel AI Gateway** (Claude default) |
| Mobile build / submit / push | Expo EAS + Expo Push |
| Web hosting | Vercel |

---

## 3. Repository structure

```
dream-starter-kit/
├─ apps/
│  ├─ nextjs/                # web — Next.js App Router (thin entry point)
│  │  └─ src/
│  │     ├─ app/(frontend)/(public)/   # public CMS pages (RSC via Payload Local API)
│  │     ├─ app/(payload)/             # Payload admin (/admin) + REST (/cms-api)
│  │     ├─ payload/                   # Payload collections, access-control, seed
│  │     └─ payload.config.ts          # Payload config (collections, db, S3 storage)
│  └─ expo/                  # mobile — Expo Router → iOS + Android (thin entry point)
├─ packages/
│  ├─ api/                   # Supabase client, generated DB types, session provider
│  ├─ app/                   # shared features: zod validators, react-query hooks, pure logic
│  ├─ cms/                   # Payload content TYPES ONLY (generated; safe to import on mobile)
│  ├─ ui/                    # shared UI tokens/primitives + theme/toast
│  └─ config/                # zod env schema + constants (DEFAULT_AI_MODEL, PLANS, rate limit)
├─ supabase/
│  ├─ migrations/            # SQL schema + RLS policies (implements ERD.md) — ships as ONE baseline migration
│  ├─ payload/               # 00_cms_role.sql — provisions the `cms` schema + payload_cms role
│  ├─ functions/             # edge functions: billing-stripe-webhook, delete-account, reminders-process
│  ├─ seed.sql               # ships EMPTY (first signup becomes the founder); add your own demo rows
│  └─ config.toml            # local stack + auth configuration
├─ tooling/                  # eslint, prettier, tailwind, tsconfig, rls-tests, web-e2e, CI setup, scripts
├─ .github/workflows/        # CI: lint, format, typecheck, test, license, integration
├─ docs/                     # ARCHITECTURE.md (this file), ERD.md
└─ CLAUDE.md · README.md · CONTRIBUTING.md · NOTICE · LICENSE
```

**The rule that keeps it clean:** anything cross-platform lives in `packages/`;
the two `apps/` stay thin.

---

## 4. How the pieces fit

### 4.1 Monorepo & build

Turborepo orchestrates the apps and packages; pnpm manages dependencies, with a
single **catalog** (in `pnpm-workspace.yaml`) so the web and mobile apps never
drift onto different versions of React, Supabase, etc. The scaffold was
originally generated from `create-t3-turbo` and then had its backend swapped to
Supabase; it is kept as a one-time snapshot (see [§7](#7-licensing) / `NOTICE`).

### 4.2 Web app — Next.js (App Router)

The landing page, public content pages, auth pages, the signed-in app home (`/a`), the
paywall, the AI chat, and the server API routes (AI proxy, Stripe checkout/portal,
push test). UI is built from **shadcn/ui** components (Radix + Tailwind) copied
into `apps/nextjs/src/components/ui`.

Because the web app also mounts Payload, the routes are split into **two root
layouts** under `app/`: a `(frontend)` group (the app + public pages, with the
shared providers/theme) and a `(payload)` group (the admin UI + REST API, which
own their own HTML shell). There is therefore **no top-level `app/layout.tsx`**;
route handlers (`app/api/*`, `app/auth/callback`) and metadata files (`robots.ts`,
`sitemap.ts`) stay at the top level. See [§4.10](#410-content--payload-cms).

### 4.3 Mobile app — Expo + Expo Router

The iOS/Android app. File-based routing mirrors the web (`(auth)` and `(app)`
route groups). UI uses **react-native-reusables** (the shadcn philosophy for
React Native) styled with **NativeWind**, so web and native look consistent.
Built and shipped with EAS ([§4.11](#411-build--ship)).

### 4.4 Shared packages — the reusable core

- **`@acme/api`** — the typed Supabase client, generated database types, the
  session provider, and the react-query query client. The single way the apps
  talk to the backend.
- **`@acme/app`** — cross-platform feature code: zod validators, react-query
  hooks (`useReminders`, `useChat`, `useNotifications`, the `usePosts`/`useEvents`/…
  content hooks, …), and pure helper logic. This is where most features live; both
  apps import from here.
- **`@acme/cms`** — Payload's **generated content types only** (no Payload runtime),
  so the Expo app can type its REST content reads without bundling the CMS.
- **`@acme/ui`** — shared design tokens, the theme provider, toasts, and the
  `cn` class helper.
- **`@acme/config`** — the zod environment schema and shared constants
  (`DEFAULT_AI_MODEL`, the `PLANS` pricing, AI token cap, the rate-limit window).

> The package scope is `@acme/*`, inherited from the scaffold. It's renameable
> (see the README) — but rename once, before building features.

### 4.5 Backend — Supabase

One Supabase project provides Postgres, **Supabase Auth** (email/password, magic
link, Google & Apple OAuth), Storage, and **Edge Functions** (Deno). Email
**confirmations are on** (locally too, matching hosted defaults): sign-up routes
to `/check-email`, completed by the emailed link (`/confirm-email` verifies the
`token_hash`, then `/welcome` routes founder → `/cms-setup`, others →
`/a`) or by typing the emailed 6-digit code (`verifyOtp`). Both kit email
templates link via `token_hash` pages rather than GoTrue redirect links, so
re-sent emails, cross-browser opens, and prefetch-happy mail scanners all work.
The schema
and the canonical security pattern live in [`ERD.md`](./ERD.md) and are applied
by the SQL files in `supabase/migrations/`. The kit ships the whole base schema
as a **single baseline migration** (`20260609000001_initial.sql` — identity,
orgs, billing, engagement, files/storage, chat, CMS staff flag); your features
extend it with **new** migrations (append-only — never edit a shipped one).

Three edge functions run server-side with the service-role key:
- **`billing-stripe-webhook`** — verifies Stripe signatures and syncs billing state.
- **`delete-account`** — verifies the caller, then deletes their auth user
  (the database cascades clean-up) and cancels any live Stripe subscription.
- **`reminders-process`** — a scheduled job that turns due reminders into
  notifications and push messages.

### 4.6 Security model (the non-negotiables)

This is the part a founder most needs to get right, so it's enforced structurally:

- **RLS on every app table.** Authorization is in Postgres, not app code. Every
  table in the `public` schema has an owner (`user_id`, or reachable through
  `memberships`) and policies that scope rows to the signed-in user (`auth.uid()`).
  A bug in app code cannot leak another user's data. There's an automated test
  (`pnpm test:rls`) that proves one user can't read or write another's rows. *(The
  one deliberate exception is Payload's `cms` schema, which is governed by Payload's
  own access-control instead — see [§4.10](#410-content--payload-cms).)*
- **The service-role key is server-only.** It bypasses RLS and appears *only* in
  edge functions / server code — never in the web client or the mobile bundle.
- **Secrets go through a zod env schema.** Every variable is validated on boot
  (`packages/config` + each app's `env.ts`); the app fails loudly if one is
  missing. `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` are public (compiled into the
  client) and hold only anon/publishable values; everything else is server-only.

### 4.7 Payments — Stripe (web)

The billing catalog is **authored in Payload** (Commerce → Plans/Coupons), not the
Stripe dashboard. Saving a plan or coupon syncs it to Stripe **automatically** via
collection `afterChange` hooks (`payload/hooks/sync-*-to-stripe.ts` →
`lib/stripe/sync.ts`) — creating a **new price and archiving the old** on any
amount change, since Stripe prices are immutable (a per-doc `skipSync` checkbox
opts out; sync failures are recorded on the doc, never failing the save).
**`@payloadcms/plugin-stripe`** provides the second half of the channel: a
signature-verified webhook endpoint at **`/cms-api/stripe/webhooks`** (its own
`STRIPE_WEBHOOKS_ENDPOINT_SECRET`) that mirrors `customer.subscription.*` events
into the read-only CMS **`subscriptions`** collection. The plugin's Stripe REST
proxy stays **off** (`rest: false`) and its declarative sync is unused — it can't
express price immutability or intro coupons, so the hooks own Payload → Stripe.

The `billing-stripe-webhook` **edge function** (signature-verified, idempotent — a
separate Stripe endpoint with `STRIPE_WEBHOOK_SECRET`) keeps mirroring the
product/price catalog and subscription status into the RLS-governed `public.*`
tables for app clients. So: **Payload → Stripe** via hooks; **Stripe → CMS
`subscriptions`** via the Payload webhook; **Stripe → `public.*`** via the edge
function. Defaults: Dream Monthly ($9.99/mo), Annual ($99.99/yr, 7-day trial)
and Lifetime ($399 one-time).

Subscriptions are sold on the **web** with Stripe Checkout (plan-driven, with
guest checkout that provisions the account post-payment) + the customer portal;
`/billing` is the self-serve hub (change/cancel, invoices). Intro offers use a
`duration:once` coupon; promotion/coupon codes are supported at checkout.

The mobile apps stay free to download and unlock premium by reading the
`subscriptions` table (RLS read-own) — so **no in-app-purchase tooling is
needed**. Selling digital goods *inside* the iOS/Android apps is out of scope
(Apple/Google require their own billing); add that yourself only if you need it.

### 4.8 AI assistant — Vercel AI SDK via the AI Gateway

AI calls go through the `ai` package to the **Vercel AI Gateway** — one endpoint
that fronts many providers, so there are no per-provider keys to manage (on
Vercel, a credential is injected automatically; locally you set
`AI_GATEWAY_API_KEY`). The default model is **Claude**, set once as
`DEFAULT_AI_MODEL` in `packages/config` and swappable in one line.

The chat route (`apps/nextjs/src/app/api/chat`) is **authenticated**,
**rate-limited per user**, and **token-capped**, and it never exposes the gateway
key to clients. Conversations persist in the `chat_threads` / `chat_messages`
tables. The mobile app calls the same route.

### 4.9 Engagement — notifications, reminders, push

In-app notifications and reminders are ordinary RLS-protected tables with shared
hooks and web + native screens. The native app registers an Expo push token; the
`reminders-process` edge function (run on a schedule) finds due reminders and
sends notifications + push. A web notification bell and a native header bell
surface unread items.

### 4.10 Content — Payload CMS

Content AND member-engagement data are managed by **Payload CMS v3 (MIT)** — the
kit's **second backend**, deliberately kept separate from the Supabase app data.
The registry spans five admin groups:

- **Content** — `posts` (the blog), `videos` (16:9 + vertical shorts), `audio`
  (podcast episodes as an upload collection, with RSS fields + tokenized private
  feeds via `feed-tokens`), `photos` (upload collection), `series` (shows /
  albums / playlists / drip **courses**, with `lessons` + `enrollments`),
  `locations`, `events`, and the `categories` / `tags` / `tag-groups` taxonomy.
  Content collections share folders (one cross-collection tree), soft delete
  (trash), drafts + scheduled publish, SEO metadata and `accessLevel` gating
  (public / members / premium).
- **Community** — `space-groups` (nested) → `community-spaces` →
  `community-posts`, with one `comments` system (threaded, gated per document
  by `commentsEnabled`) and a `reports` moderation queue.
- **People** — the single `users` collection (see SSO below), `device-tokens`,
  `feed-tokens`, `favorites`, `enrollments` and `reviews`.
- **Commerce** — `plans`, `coupons` and the webhook-written `subscriptions`
  mirror (§4.7).
- **Marketing** — block-based `pages`, `onboarding` slides, `banners`,
  `notifications`, and the Form Builder plugin's `forms`/`form-submissions`.

Globals: `site-settings`, `pricing-settings`, `theme-settings` and
`profile-fields` (admin-defined custom member fields validated into
`users.customFields`). Plugins: SEO, Nested Docs (categories / pages /
space-groups), Form Builder and Stripe (§4.7).

Access control is **role-based**: `users.roles` is a multi-select of
`admin | editor | author | member`. Staff (admin/editor, plus author for the
panel) get the admin UI; every app signup is mirrored in as a `member`.
Member-scoped collections (favorites, comments, device-tokens, …) carry
owner-scoped access rules (`ownsOrStaff`), with the owner forced to the
requesting user on create — but note the **SSO bridge currently authenticates
staff only**, so members reach this data through your own server routes for
now; opening `/cms-api` to member sessions is a documented follow-up.

Boundary with Supabase: security-critical per-user state that RLS clients
consume directly (auth, `profiles`, billing entitlements in
`public.subscriptions`, chat, reminders) stays in `public` under RLS.

How the two backends stay separate:

- **Web/server only.** Payload runs inside the Next.js server (Node) — never in the
  mobile bundle. Its admin UI is at **`/admin`** and its REST API at **`/cms-api`**
  (moved off `/api` so it never collides with `/api/chat`, `/api/stripe/*`,
  `/api/push/*`). Collections live in `apps/nextjs/src/payload/collections/`; the
  config is `apps/nextjs/src/payload.config.ts`.
- **Its own `cms` schema, outside RLS.** Payload owns a dedicated **`cms`** Postgres
  schema *inside the same Supabase database*, but **outside Supabase RLS** by design
  — access is enforced by Payload's own role-based access-control (e.g. published-or-staff, owner-scoped rows). It
  connects as a least-privilege role **`payload_cms`** (USAGE+CREATE on `cms` only;
  nothing on `public`/`auth`) — **not** the service-role key, and server-only. The
  role + schema are created by `supabase/payload/00_cms_role.sql`, applied
  automatically on `supabase db reset` (wired via `config.toml`
  `[db.seed].sql_paths`); on hosted Supabase the **runtime DB bootstrap** (see
  § Runtime DB bootstrap below) creates them on first boot, with the password taken
  from `PAYLOAD_DATABASE_URL` (running the SQL file once in the SQL editor remains
  the manual fallback / rotation path). Payload's own tables are created and
  migrated by Payload (`pnpm cms:migrate`).
- **Single sign-on from Supabase Auth.** There is **one** login. Payload doesn't keep
  its own password — a custom auth strategy (`apps/nextjs/src/payload/auth/supabase-strategy.ts`,
  wired on the `users` collection with `disableLocalStrategy: true`) authenticates every
  CMS request from the caller's existing **Supabase** session and provisions a `cms.users`
  row on first access, linked by `supabaseUserId`. Authorization is **default-deny**: only
  app users flagged **`profiles.is_staff`** may enter the CMS (the first signup is
  auto-flagged staff), and a column-level `revoke` stops users self-escalating. Further
  editors are **invited from the admin** (`/admin` → Users → Create New): a collection
  hook (`payload/hooks/invite-user.ts`) sends `auth.admin.inviteUserByEmail` and flags
  `is_staff` via a server-only service-role client (`lib/supabase/admin.ts`) — the one
  sanctioned service-role use in the web app; the invitee lands on `/accept-invite`,
  which verifies the emailed `token_hash` (custom invite template — keeps the one-time
  token out of the redirect chain, where prefetchers/navigation restarts would burn it;
  the default template's implicit-flow hash tokens are handled as a fallback) and sets
  a password. The bridge stays within the kit's isolation rules — it runs
  in the Next.js server (reading `profiles` via the user's own RLS session, provisioning
  via Payload's Local API), **never** as the `payload_cms` role and **never** with the
  service-role key. The `/admin` route is gated in `proxy.ts` (anonymous → `/sign-in`,
  non-staff → `/a`), which also refreshes the Supabase session on CMS paths.
- **Media in Supabase Storage.** Uploads go to a dedicated **public-read** bucket
  **`cms-media`** (separate from the RLS-governed `user-files` bucket) via the S3
  storage adapter (`forcePathStyle: true`).
- **How each surface reads content.** The **web** renders public pages as React
  Server Components via Payload's **Local API** (in-process, fast, SEO-friendly),
  under `app/(frontend)/(public)/`. **Mobile** reads the same content over **REST**
  (`/cms-api`) through shared hooks in `@acme/app` (`usePosts`, `useEvents`, …),
  typed by `@acme/cms`, with native screens under `apps/expo/src/app/(app)/content/`.

### 4.11 Build & ship

- **Mobile:** Expo **EAS Build** (cloud builds, no local native toolchain) +
  **EAS Submit**. Profiles (`dev`/`preview`/`production`) are in `apps/expo/eas.json`.
- **Push:** **Expo Push** (free). Remote push requires a **dev build on a physical
  device** — Expo Go can't receive it on Android (SDK 53+).
- **Web:** Vercel (preview deploys, edge, SEO). Fastest setup is the one-click deploy
  plus the Supabase Marketplace integration (it auto-injects the Supabase env) — see
  the README's Deploy section.

#### Runtime DB bootstrap (zero-touch provisioning)

A fresh hosted Supabase project is **empty** — and the kit provisions it itself, so a
deploy needs no manual `supabase db push` or SQL-editor step. On server boot,
`instrumentation.ts` runs two strictly-ordered jobs, after which the existing
post-signup flow takes over:

```
boot ─ bootstrapDatabase()                 ─ getPayload() warm-up      ─ first signup
       ├ apply supabase/migrations/*.sql     └ Payload prodMigrations    └ trigger flags founder
       ├ create cms schema + payload_cms       build the cms.* tables      → /welcome → /cms-setup
       └ backfill profiles                                                 → seed CMS demo content
```

`apps/nextjs/src/lib/db/bootstrap.ts` connects over the session-mode admin URL
(`SUPABASE_DB_URL`, or the integration-injected `POSTGRES_URL_NON_POOLING`) and:

- applies pending `supabase/migrations/*.sql` — bundled into the build as a committed
  JSON module (`pnpm db:gen-migrations`; drift fails `pnpm test`) — one transaction per
  file, recorded in the **same ledger the Supabase CLI uses**
  (`supabase_migrations.schema_migrations`), so the bootstrap and a manual
  `supabase db push` are interchangeable in either order;
- creates the `cms` schema + least-privilege `payload_cms` role (mirroring
  `00_cms_role.sql`; password from `PAYLOAD_DATABASE_URL`, create-only — it never
  alters an existing role's password and refuses the dev password in production);
- backfills `public.profiles` for any account created before the trigger existed,
  flagging the earliest signup as the founder.

It's concurrency-safe (session advisory lock, double-checked inside), idempotent (a
provisioned DB short-circuits after one cheap inspection), skipped during `next build`
and when no admin URL is set, and it **never throws** — failures log `[db-bootstrap]`
and the app degrades to the manual flow. Opt out with `DB_BOOTSTRAP=off`.

---

## 5. External services (the signups)

| Service | Used for | Free to start | Required |
|---|---|---|---|
| Supabase | Database, Auth, Storage, Edge Functions | Yes | Yes |
| Vercel | Web hosting + the AI Gateway | Yes (Hobby) | Yes |
| Expo (EAS) | iOS/Android builds, submit, push | Yes | For mobile builds |
| Stripe | Web subscriptions | Yes (per-txn) | For monetization |

Core path is **four signups** + GitHub. AI runs through the Vercel AI Gateway
under your Vercel account (billed pass-through at provider rates) — no separate
AI-provider signup.

---

## 6. Quality gates

Every change is expected to pass, locally and in CI:

- `pnpm typecheck` · `pnpm lint` · `pnpm test` (Vitest unit/integration)
- `pnpm test:rls` — proves cross-user data isolation against a real Postgres
- `pnpm test:e2e` — Playwright critical-path against the running web app
- `pnpm license:check` — fails on strong copyleft in the dependency tree
- `next build` + `expo export` build cleanly

CI (`.github/workflows/ci.yml`) runs all of these on every pull request,
including an `integration` job that boots a real Supabase stack.

---

## 7. Licensing

The kit ships under **Apache License 2.0** ([`LICENSE`](../LICENSE)). Third-party
attributions are in [`NOTICE`](../NOTICE):

- The scaffold derives from **create-t3-turbo (MIT)** — its copyright + MIT
  notice are retained; the forked commit SHA is pinned for provenance. It is a
  one-time snapshot, not a tracked upstream (the Supabase swap diverges from it),
  so discrete upstream fixes are cherry-picked rather than merged.
- The **Vercel AI SDK (`ai`)** is **Apache-2.0** — the same license as this repo.
- **shadcn/ui** and **react-native-reusables** are **MIT**; their source is copied
  into the repo and upstream attribution headers are preserved.
- **Payload CMS** and its adapters (`@payloadcms/*`) are **MIT** and pass
  `license:check`. Payload's image pipeline pulls **`sharp`**, whose native
  `sharp-libvips` dependency is **LGPL** — weak, file-level copyleft that the gate
  allows (it's linked, not modified). No Payload source is vendored.
- Everything else is permissive (mostly MIT). `pnpm license:check` enforces this:
  it fails on strong copyleft (GPL/AGPL/SSPL) and allows permissive plus weak,
  file-level copyleft (LGPL/MPL) that is safe to depend on.

*(Engineering guidance, not legal advice — have counsel review anything load-bearing.)*

---

## 8. Keeping dependencies current

Versions are centralized in the pnpm **catalog** (`pnpm-workspace.yaml`) so a bump
is one line and web/native never drift. Update channels:

| Component | How to update |
|---|---|
| npm packages (AI SDK, Stripe, Supabase, Next.js, React Query, Tailwind/NativeWind, …) | `pnpm update` — Renovate is preconfigured in `.github/renovate.json` to open update PRs |
| Payload CMS (`payload`, `@payloadcms/*`, `sharp`) | catalog-pinned like everything else — `pnpm update` / Renovate. No Payload source is vendored. Run `pnpm cms:gen-types` after changing collections |
| Expo SDK + `expo-*` + React Native | `expo install --fix` + the Expo SDK upgrade guide (let Expo own native-compatible versions) |
| shadcn/ui & react-native-reusables | re-run the registry add (`pnpm ui-add <component>`), diff, re-apply your edits |
| create-t3-turbo scaffold | cherry-pick discrete fixes only (not a tracked dependency) |

---

## 9. Caveats & gotchas

- **Store billing rules.** In-app digital subscriptions must use Apple/Google
  billing; this kit sells on the **web** only ([§4.7](#47-payments--stripe-web)).
- **Push needs a dev build.** Remote push doesn't work in Expo Go on Android
  (SDK 53+) — test in a dev build ([§4.11](#411-build--ship)).
- **AI model slugs change.** They live in one place (`DEFAULT_AI_MODEL`); update
  there, don't hardcode elsewhere.
- **Payload + Next 16 bundler.** Payload v3 required bumping `next` to `^16.2.6`. If
  the admin fails to build/run under Next 16's default Turbopack, fall back to Webpack
  (`next dev --webpack` / `next build --webpack`).
- **Payload DB connection.** Point `PAYLOAD_DATABASE_URL` at the **direct/session**
  Postgres connection (not the transaction pooler) — Payload's migrations and prepared
  statements need a session-mode connection.
- **Two auth systems.** Payload `users` (content editors at `/admin`) are **not**
  Supabase users (app users). Different tables, different sessions — don't conflate them.
