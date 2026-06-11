# Dream Starter Kit

A clone-and-ship starter: one **Turborepo** monorepo shipping a **Next.js web app**
and an **Expo (iOS + Android) app** that share **one Supabase backend**
(Postgres + Auth + Row-Level Security + Storage + Edge Functions). Stripe billing,
a Vercel-AI-Gateway assistant, Expo push notifications, and a **Payload CMS** content
backend are wired in. Clone it, rename a few things, and extend it into a real product.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvytenapps%2Fdream-starter-kit&root-directory=apps%2Fnextjs&project-name=dream-starter-kit&repository-name=dream-starter-kit)

> Deploys the **web app** to Vercel with no env required — it builds with placeholder
> Supabase config, so the deploy **succeeds**. To make it actually work, connect the
> **Vercel↔Supabase integration** (it injects `NEXT_PUBLIC_SUPABASE_URL` +
> `NEXT_PUBLIC_SUPABASE_ANON_KEY`) or add them in Project Settings, apply the migrations,
> and **redeploy** — see [Deploy](#deploy). If you fork this repo, update the org/name in
> the button URL to point at your fork.

> **Not an engineer?** You can still use this. Setup is copy-paste (below), and the
> kit is structured so an AI coding assistant like [Claude Code](https://claude.com/claude-code)
> can extend it feature-by-feature — see [`CLAUDE.md`](./CLAUDE.md) for the recipe it follows.

### What you get out of the box

- **Auth** — email/password, magic link, Google & Apple OAuth (Supabase Auth), with
  protected routes on web + native and account deletion.
- **A real data feature** — `reminders` CRUD on web *and* native from one set of
  shared react-query hooks, fully protected by Row-Level Security. This is the
  reference pattern you copy for your own per-user tables.
- **A content CMS** — **Payload CMS v3** manages editorial/marketing content
  (`posts`, `videos`, `audio`, `photos`, `series`/courses, `locations`, `events`, plus community, engagement and marketing collections) from
  an admin at **`/admin`**. Public pages render **server-side** for SEO; the mobile app
  reads the same content over REST. Payload runs web-only and owns its own `cms` schema
  outside RLS (see [Architecture → Content](./docs/ARCHITECTURE.md#410-content--payload-cms)).
- **Billing** — Stripe Checkout + customer portal + a signature-verified, idempotent
  webhook. A single **Pro** plan (Monthly **$9.99** / Yearly **$99**). Mobile unlocks
  premium by reading the `subscriptions` table (no IAP).
- **AI assistant** — Vercel AI SDK v6 → Claude through the AI Gateway, behind an
  authed, rate-limited, token-capped server route; conversations persist.
- **Engagement** — in-app notifications, reminders, and Expo push (with a scheduled
  edge function to fire due reminders).
- **Quality gates** — typecheck, lint, Vitest, an RLS isolation regression, Playwright
  e2e, and a copyleft license check — all run in CI.

## Source of truth

- **[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)** — stack, structure, security model, and dependency policy.
- **[`docs/ERD.md`](./docs/ERD.md)** — data model + the canonical RLS pattern every table follows.
- **[`docs/CMS.md`](./docs/CMS.md)** — the Payload CMS reference: every collection, global, field & access rule.
- **[`CLAUDE.md`](./CLAUDE.md)** — working agreement, the golden security rules, and the "how to add a feature" recipe.

If anything here disagrees with those, **they win.**

## Stack

| Layer | Choice |
|---|---|
| Monorepo | Turborepo + pnpm (forked from create-t3-turbo) |
| Web | Next.js (App Router) · shadcn/ui · Tailwind · Payload admin at `/admin` |
| Mobile | Expo + Expo Router · react-native-reusables · NativeWind |
| Backend | Supabase — Postgres + Auth + RLS + Storage + Edge Functions (Deno) |
| Content / CMS | Payload CMS v3 (web/server only) — own `cms` schema, REST at `/cms-api` |
| Data layer | `@supabase/supabase-js` typed client + react-query hooks (`packages/api`) |
| Payments | Stripe (web only) + webhook edge function |
| AI | Vercel AI SDK v6 via the AI Gateway (Claude default) |
| Ship | Vercel (web) · EAS (mobile) · Expo Push |

> The package scope is `@acme/*` (inherited from the template) — renameable; see
> **[Rename the package scope](#rename-the-package-scope)**. Don't rename mid-build.

## Prerequisites

- **Node 22** — `.nvmrc` pins `22.21.0`; run `nvm use`.
- **pnpm 10** — `corepack enable` (or `npm i -g pnpm@10`).
- **Supabase CLI** + **Docker** — for the local Postgres/Auth/Storage stack.
- A few **free-tier accounts** (see next section). Local dev needs only Supabase.

## Accounts you'll need

| Service | What it's for | When |
|---|---|---|
| **[Supabase](https://supabase.com)** | Postgres, Auth, Storage, Edge Functions | Local dev (CLI) + production |
| **[Vercel](https://vercel.com)** | Hosts the web app; injects the **AI Gateway** credential | Web deploy + AI |
| **[Expo / EAS](https://expo.dev)** | Mobile builds, submissions, and push delivery | Mobile builds + push |
| **[Stripe](https://stripe.com)** | Subscriptions (web only) | Billing |

AI runs through the **Vercel AI Gateway**, so there's no separate AI-provider signup —
on Vercel an OIDC token is injected automatically; locally set `AI_GATEWAY_API_KEY`.

## Get started

The fastest path is to **fork → run locally → make it yours**. (Prefer to host
first? Use the [Deploy button](#dream-starter-kit) above.)

### 1. Fork & clone

Click **Fork** at the top of the GitHub page to create your own copy, then clone it:

```bash
git clone https://github.com/<your-username>/dream-starter-kit.git
cd dream-starter-kit
```

### 2. Install (Node 22 + pnpm 10)

```bash
nvm use            # uses .nvmrc → Node 22.21.0  (or install Node 22)
corepack enable    # provides pnpm 10
pnpm install
```

### 3. Start the local backend

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli) + Docker.

```bash
cp .env.example .env
supabase start     # boots local Postgres/Auth/Storage; prints your API URL + keys
pnpm db:reset      # applies migrations + seed.sql (ships EMPTY — the first signup
                   #   becomes the founder), provisions the Payload `cms` schema +
                   #   payload_cms role (config.toml [db.seed].sql_paths, local-only),
                   #   then runs `cms:migrate` to build the Payload tables so a running
                   #   dev server stays in sync after a reset
```

> Use `pnpm db:reset` rather than bare `supabase db reset`: the former also runs
> `pnpm cms:migrate`, which re-creates Payload's `cms` tables. A plain `supabase db
> reset` drops them and a *running* `next dev` won't recreate them until restarted.

> Payload connects as the dedicated `payload_cms` role using the local
> `PAYLOAD_DATABASE_URL` from `.env.example` — make sure you copied the full
> `PAYLOAD_*` / `S3_*` block into your `.env` (step above), or `/admin` will 500
> with `password authentication failed for user "payload_cms"`.

Payload's `cms` tables are auto-created in dev on first boot. **The CMS shares your
Supabase login — there's no separate Payload account.** Sign up through the app (step 4)
and confirm your email — confirmations are on locally to match hosted Supabase; the
confirmation email (link + a manual 6-digit code) lands in **Mailpit** at
http://127.0.0.1:54324. The **first** signup is automatically flagged staff (the
founder/admin). Open `/admin` while signed in and you're let straight into the CMS — the
kit provisions your CMS user, then seeds demo content (pages, posts, an event, site
nav) with a progress bar and drops you into the admin. To add more editors later, invite
them from **`/admin` → Users → Create New** — they get a Supabase invite email and set a
password on `/accept-invite` (requires `SUPABASE_SERVICE_ROLE_KEY` in the web app's env).
The `pnpm cms:seed` CLI is still available for headless/CI setup.

Paste the printed **API URL**, **anon key**, and **service_role key** into `.env`
(see [Environment variables](#environment-variables) for which is which). The Payload
env (`PAYLOAD_*`, `S3_*`) ships with working local defaults in `.env.example`; set
`PAYLOAD_SECRET` and the local anon key as `S3_SECRET_ACCESS_KEY`. The CMS admin is at
**http://localhost:3000/admin**.

### 4. Run it

```bash
pnpm dev:next      # web only  →  http://localhost:3000
pnpm dev           # web + mobile together (turbo watch)
```

The database ships **empty** (no seeded accounts), so the **first account you
sign up becomes the owner** — it's auto-flagged staff and gets Payload CMS admin
access at `/admin`. Open the web app, hit **Sign up**, and you're the founder.

### 5. Make it yours

Rebrand the identity and swap in your own services — see
[Make it yours](#make-it-yours). Then build features with the recipe in
[`CLAUDE.md`](./CLAUDE.md).

### 6. Ship it

Deploy the web app to Vercel and the mobile app via EAS — see [Deploy](#deploy).

---

Run the gates before every commit:

```bash
pnpm typecheck && pnpm lint && pnpm test
```

## Environment variables

Every variable is validated by a zod schema (`packages/config/env` + each app's
`env.ts`); **the app fails loudly on boot if a required one is missing or malformed.**
`.env.example` is the annotated source — copy it to `.env` and fill it in.

**Security model (non-negotiable):**

- `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` are **compiled into the client bundle** → public.
  Only ever put anon/publishable values there.
- Everything else is **server-only** (Next server code + Supabase edge functions).
- The Supabase **service-role key bypasses RLS** and lives **only** server-side
  (edge functions / server routes) — never in web client or mobile code.

| Variable | Public? | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_URL` | ✅ | `supabase start` output / Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ✅ | same |
| `SUPABASE_SERVICE_ROLE_KEY` | 🔒 | same (server-only; bypasses RLS) |
| `SUPABASE_DB_URL` | 🔒 | local default in `.env.example` / hosted pooler URL |
| `CRON_SECRET` | 🔒 | you choose; guards the `process-reminders` function |
| `NEXT_PUBLIC_APP_URL` / `EXPO_PUBLIC_API_URL` | ✅ | your web origin (LAN IP in mobile dev). On Vercel the web origin is auto-detected — see `NEXT_PUBLIC_SITE_URL` |
| `NEXT_PUBLIC_SITE_URL` | ✅ | optional — pin the public web origin to a custom domain; else auto-detected on Vercel / falls back to `NEXT_PUBLIC_APP_URL` |
| `AI_GATEWAY_API_KEY` | 🔒 | [Vercel AI Gateway](https://vercel.com/ai-gateway) (auto on Vercel) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | 🔒 | Stripe Dashboard / `stripe listen` |
| `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY` | 🔒 | Stripe price IDs (`price_…`) |
| `PAYLOAD_DATABASE_URL` | 🔒 | `payload_cms` role connection (`search_path=cms`); local default in `.env.example` |
| `PAYLOAD_SECRET` | 🔒 | you choose (`openssl rand -base64 32`) — Payload admin auth/encryption |
| `S3_ENDPOINT` / `S3_REGION` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_BUCKET` | 🔒 | Supabase Storage (S3) for Payload media — the `cms-media` bucket; local defaults in `.env.example` |
| `NEXT_PUBLIC_CMS_URL` / `EXPO_PUBLIC_CMS_URL` | ✅ | Payload REST origin (mobile reads content; web is same-origin) |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_*` / `_APPLE_*` | 🔒 | OAuth provider consoles (local dev only; prod uses the Dashboard) |
| `EXPO_PUBLIC_EAS_PROJECT_ID` / `EXPO_PUBLIC_AUTH_SCHEME` | ✅ | `eas init` / `app.config.ts` `scheme` |

The AI model id is **not** an env var — it's centralized in `packages/config`
(`DEFAULT_AI_MODEL`) and is swappable.

## Running the mobile app

```bash
pnpm dev                # or: pnpm -F @acme/expo dev
```

- Point `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_API_URL` at your machine's **LAN IP**
  (not `localhost`) so a device can reach the local stack.
- **Push notifications require a dev build** (`eas build --profile development`) on a
  **physical device** — Expo Go can't receive remote push (Android, SDK 53+). The
  emulator/simulator returns no token.

## Repo structure

```
apps/nextjs        # web — Next.js App Router, shadcn/ui (thin entry point)
  src/app/(frontend)/(public)/  # public CMS pages (server-rendered via Payload Local API)
  src/app/(payload)/            # Payload admin (/admin) + REST (/cms-api)
  src/payload/                  # Payload collections, access-control, seed
  src/payload.config.ts         # Payload config (collections, db, S3 storage)
apps/expo          # mobile — Expo Router, react-native-reusables (thin entry point)
packages/api       # Supabase data layer: typed client, generated DB types, react-query hooks
packages/app       # cross-platform features: zod validators, hooks (incl. content hooks), pure logic
packages/cms       # Payload content TYPES ONLY (generated; safe to import on mobile)
packages/ui        # shared UI tokens/primitives + theme/toast
packages/config    # zod env schema + constants (DEFAULT_AI_MODEL, PLANS, rate limit)
supabase/          # migrations (schema + RLS), payload/ (cms role+schema), seed.sql, edge functions, config.toml
tooling/           # eslint / prettier / tailwind / tsconfig + rls-tests + web-e2e + CI setup
```

**Cross-platform logic lives in `packages/`; `apps/*` are thin.** New data features
follow the recipe in `CLAUDE.md` (migration + RLS + FK index → types → validator →
hook → web & native UI → tests).

## Make it yours

This repo ships **neutral placeholders** so it stays a clean template. Forking it
for a real app is mostly swapping identity + secrets — and almost all the secrets
are env vars, so the source-level edits are small.

**Identity (source):**

- [ ] **App name** — `APP_NAME` in `packages/config` (the short brand), plus the web
      titles/OG in `apps/nextjs/src/app/(frontend)/layout.tsx` and
      `(frontend)/opengraph-image.tsx`. (There's no top-level `app/layout.tsx` — the app
      lives in the `(frontend)` route group and Payload's admin in `(payload)`.)
- [ ] **Bundle id** — `apps/expo/app.config.ts` (`ios.bundleIdentifier` + `android.package`),
      shipped as the placeholder `com.example.dreamstarter`.
- [ ] **Deep-link scheme** — set `EXPO_PUBLIC_AUTH_SCHEME` (default `dreamstarter` in
      `app.config.ts`) and update the matching `…://auth-callback` entry in
      `supabase/config.toml` **and** your Supabase dashboard redirect URLs.
- [ ] **Package scope** — `@acme/*` is workspace-internal (never published) and fine to
      keep; rename only if you want branded imports (see below).

**Config (env — no source changes):**

- [ ] Supabase project + keys, Stripe products/keys + webhook, `AI_GATEWAY_API_KEY`,
      `EXPO_PUBLIC_EAS_PROJECT_ID` (`eas init`), `NEXT_PUBLIC_APP_URL` — see
      [Environment variables](#environment-variables) and [Deploy](#deploy).
- [ ] **License** — keep Apache-2.0 or relicense your fork (Apache lets you build a
      proprietary product on top); update the copyright line in `NOTICE`.

Then add your own product data. There's **no** example domain to rename — instead you
add tables/content for your idea:

### Add your own feature

The kit ships two reference shapes to copy, depending on whose data it is:

- **Per-user app data** (your product's records, protected by RLS) — copy the
  **`reminders`** feature: a migration (table + RLS + FK index), a validator, shared
  react-query hooks, web + native screens, and an RLS test. Full recipe in
  [`CLAUDE.md`](./CLAUDE.md#how-to-add-a-modular-feature).
- **Editorial / marketing content** (the same for every visitor — posts, events,
  pages) — add a **Payload collection** instead of a Supabase table. It's served on
  public pages and to mobile over REST, and is governed by Payload's access-control
  (not RLS). Recipe in
  [`CLAUDE.md` → How to add a Payload content type](./CLAUDE.md#how-to-add-a-payload-content-type).

### Rename the package scope

`@acme/*` is inherited. To rebrand to `@your-scope/*`, do a careful find-and-replace
across `package.json` files, `tsconfig` paths, and imports, then `pnpm install`. Do it
**once, before building features** — not mid-stream.

## Testing

```bash
pnpm test            # Vitest unit/integration — no backend needed
pnpm test:rls        # RLS isolation regression — needs `supabase start` + .env
pnpm test:e2e        # Playwright e2e — needs `supabase start` + db reset; boots `next dev`
pnpm license:check   # fails on strong copyleft (GPL/AGPL/SSPL) in the prod tree
```

CI (`.github/workflows/ci.yml`) runs lint · format · typecheck · unit · license on
every PR, plus an `integration` job that boots a real Supabase and runs `test:rls` +
Playwright. See [`tooling/web-e2e/README.md`](./tooling/web-e2e/README.md).

## Deploy

### Fastest path — Vercel one-click + the Supabase integration

The [**Supabase integration**](https://vercel.com/marketplace/supabase) on the Vercel
Marketplace provisions a Postgres/Auth/Storage project and **auto-injects** the env the
app needs — including `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` (plus `POSTGRES_*`) — so you type no Supabase secrets by hand.

1. **Deploy** — click [Deploy with Vercel](#dream-starter-kit) at the top. Vercel clones
   the repo and builds with placeholder Supabase config (no env required upfront), so the
   deploy **succeeds** — but the app won't work until you connect Supabase and redeploy
   (next steps).
2. **Add Supabase** — in the new Vercel project open **Storage → Create Database →
   Supabase** (or install from the [Marketplace](https://vercel.com/marketplace/supabase)),
   and create a new project. Vercel writes the Supabase + Postgres env vars into the
   project automatically.
3. **Apply the schema** — nothing to run. The integration creates an *empty* database,
   and the app **provisions it itself on first boot**: a runtime bootstrap
   (`apps/nextjs/src/lib/db/bootstrap.ts`) applies `supabase/migrations` over the
   integration-injected `POSTGRES_URL_NON_POOLING` (or `SUPABASE_DB_URL` if you set one),
   recording them in the same ledger the CLI uses. `supabase link && supabase db push`
   remains a supported manual/CI alternative — either order is safe, and
   `DB_BOOTSTRAP=off` disables the runtime path entirely. Deploy the edge functions —
   see [Backend (Supabase)](#backend-supabase).
4. **Redeploy** — in Vercel, **Deployments → ⋯ → Redeploy** so the build picks up the
   injected env vars. The web app should now be live (the first boot runs the DB
   bootstrap above).
5. **Finish config** — in the Supabase dashboard set **Authentication → URL
   Configuration**. **This is required** — a fresh Supabase project defaults its Site URL
   to `http://localhost:3000` and the integration doesn't change it, so until you do this
   magic-link / confirmation / OAuth redirects bounce back to `localhost` (you'll land on
   `http://localhost:3000/?code=...`). Set:
   - **Site URL** → `https://<your-domain>`
   - **Redirect URLs** (add each) → `https://<your-domain>/**` · `https://*.vercel.app/**`
     (Vercel preview deploys, optional) · `http://localhost:3000/**` (local dev) ·
     `dreamstarter://auth-callback` (native app). The `/**` matters — it lets the
     `/auth/callback?next=…` query through.

   Then enable any OAuth providers. You do **not** need to set the app's own URL — it's
   auto-detected from Vercel's `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL` (set
   `NEXT_PUBLIC_SITE_URL` only to pin a custom domain). For billing/AI add `STRIPE_*` +
   `AI_GATEWAY_API_KEY` in Vercel (the AI Gateway credential is auto-injected on Vercel).

   Hosted projects have **email confirmations ON** by default — the kit's sign-up flow
   handles this (`/check-email`, link or manual code), and local dev matches
   (`enable_confirmations = true` in `supabase/config.toml`). Mirror the kit's two email
   templates in **Authentication → Emails**:
   - **Confirm signup** ← [`supabase/templates/confirmation.html`](./supabase/templates/confirmation.html)
     — links to `/confirm-email?token_hash=…` (works for original **and re-sent**
     confirmations, from any browser — re-sent links from the default template are
     broken by design, since re-sends carry no PKCE state) and shows the
     `{{ .Token }}` code the manual-code option on `/check-email` needs.
   - **Invite user** ← [`supabase/templates/invite.html`](./supabase/templates/invite.html)
     — links straight to `/accept-invite?token_hash=…` so the one-time invite token is
     verified explicitly by the page instead of being consumed by following a redirect;
     the default link-style token gets burned by mail-scanner prefetch or a browser
     navigation restart. (`/accept-invite` is covered by the `/**` Redirect URL wildcard
     above — no extra entry needed.)

   Also consider custom SMTP (**Authentication → Emails → SMTP**): Supabase's built-in
   sender is heavily rate-limited (~2 emails/hour) and meant for testing only.

   > **Signed up before configuring the URLs?** The first confirmation link will have
   > redirected to `localhost` (or expired on a retry) — the account is fine. The
   > `is_staff` founder flag is granted at **sign-up**, not at confirmation, and the
   > link's first click usually confirmed the email anyway (only the redirect broke).
   > Just **sign in**: you'll be routed through `/welcome` into `/cms-setup` (the CMS
   > seeds on the founder's first entry) and on to `/admin`. If the email really is
   > still unconfirmed, signing in re-sends a fresh confirmation and lands on
   > `/check-email`, and `/profile` shows a **Verify email** button — signing up again
   > with the same address also re-sends.
6. **Set up the CMS** — add the `PAYLOAD_*` + `S3_*` env in Vercel and redeploy; the
   same first-boot bootstrap creates the `cms` schema + `payload_cms` role (with the
   password you put in `PAYLOAD_DATABASE_URL`) and Payload applies its own committed
   migrations. Then log into `/admin` — see
   [Content backend (Payload CMS)](#content-backend-payload-cms).

### Backend (Supabase)

The SQL schema needs **no manual step** — the deployed app applies
`supabase/migrations` itself on first boot (see Deploy step 3). Pushing by hand still
works and stays in sync (both write the Supabase CLI's
`supabase_migrations.schema_migrations` ledger); edge functions and their secrets are
the part that's still deployed from the CLI:

```bash
supabase link --project-ref <your-ref>
supabase db push                          # optional — the app already did this on boot
supabase functions deploy stripe-webhook  # + delete-account, process-reminders
supabase secrets set STRIPE_SECRET_KEY=… STRIPE_WEBHOOK_SECRET=… CRON_SECRET=…
```

Enable OAuth providers and set redirect URLs in the Supabase Dashboard (Auth →
Providers / URL Configuration). Schedule `process-reminders` (pg_cron / a scheduler)
with the `CRON_SECRET` in the `Authorization` header.

### Content backend (Payload CMS)

Payload runs inside the deployed web app. Its `cms` schema + login role aren't captured
by `supabase db push` (`CREATE ROLE` isn't diffed) — instead the **runtime bootstrap
creates them on first boot**, taking the password from `PAYLOAD_DATABASE_URL`:

1. **Env** — in Vercel set the server-only `PAYLOAD_DATABASE_URL`: the `payload_cms`
   role's connection string with a **real password you choose** (the bootstrap creates
   the role with it — create-only, it never alters an existing role's password, and it
   refuses the local dev password in production). Use the **direct/session** Postgres
   connection (port 5432), not the transaction pooler, and keep the
   `?options=-c%20search_path%3Dcms` suffix (see `.env.example`). Also set
   `PAYLOAD_SECRET` and the `S3_*` vars (point them at your Supabase Storage S3
   endpoint; the **public-read `cms-media`** bucket itself ships as a migration). For
   mobile, set `EXPO_PUBLIC_CMS_URL` to your web origin.

   > Prefer to provision by hand (or rotate the password later)? Run
   > [`supabase/payload/00_cms_role.sql`](./supabase/payload/00_cms_role.sql) in the
   > Supabase dashboard **SQL editor** — it remains the manual fallback.
2. **Migrate** — nothing to run. Production has dev-push OFF, so Payload's tables come
   from committed migrations (`apps/nextjs/src/payload/migrations`), which Payload applies
   **automatically on first boot** via the adapter's `prodMigrations` — idempotent, tracked
   in the `cms.payload_migrations` ledger. An initial migration ships with the kit, so a
   fresh deploy self-provisions the `cms` schema on the first request. After you change a
   collection, regenerate with `pnpm cms:migrate:create` and **commit** the new file; the
   next deploy applies it. (`pnpm cms:migrate` still works for applying against any DB by
   hand, but isn't needed in the deploy flow.)
3. **Log in** — sign up through the app first (confirm via the email Supabase sends);
   the **first** signup is auto-flagged staff. Then open `https://<your-domain>/admin`
   while signed in — the CMS shares your Supabase login (no separate Payload account),
   provisions your CMS user, and triggers the demo-content seed (with a progress bar)
   before landing in the admin, so the CMS is populated out of the box; edit or replace
   that content for real prod. Grant more editors from **`/admin` → Users → Create
   New** — they receive a Supabase invite email and set a password on `/accept-invite`
   (needs `SUPABASE_SERVICE_ROLE_KEY` set in Vercel; inviting an email that already has
   an account just promotes it to staff, without sending an email).

> If the Payload admin fails to build/run under Next 16's default Turbopack, build
> the web app with Webpack (`next build --webpack`).

### Web (Vercel) — manual alternative

Prefer to wire env yourself instead of using the integration above? Import the repo, set
the root directory to `apps/nextjs`, and add the Supabase env vars
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
plus any `STRIPE_*` / `AI_GATEWAY_API_KEY` (the AI Gateway credential is injected
automatically on Vercel). Add a Stripe webhook endpoint pointing at the deployed
`stripe-webhook` function and copy its signing secret into Supabase secrets.

### Mobile (EAS)

```bash
eas build --profile development   # dev client (push, debugging)
eas build --profile preview       # internal distribution / simulator
eas build --profile production    # store builds (auto-increments versions)
eas submit --profile production
```

Profiles are in [`apps/expo/eas.json`](./apps/expo/eas.json) (pinned to Node 22.21.0 /
pnpm 10.19.0). Set `EXPO_PUBLIC_*` values as EAS env/secrets.

## Billing setup (Stripe)

1. Create one **Pro** product with two recurring prices — **$9.99/mo** and **$99/yr** —
   and put their IDs in `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY`. Amounts assume
   USD; to bill in another currency create the prices in that currency (Stripe price
   IDs are immutable, so set the amount/interval correctly the first time). The display
   strings live in `packages/config` (`PLANS`).
2. Local webhook: `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook`
   and copy the `whsec_…` into `STRIPE_WEBHOOK_SECRET`.
3. The webhook is signature-verified and idempotent; it syncs the catalog +
   subscription state into Supabase. Mobile reads `subscriptions` (RLS read-own).

## Dependencies

Versions are pinned in the pnpm **catalog** (`pnpm-workspace.yaml`) so web and
mobile never drift. The notable direct dependencies and why they're here:

**Monorepo & tooling**

- **turbo** (Turborepo) — runs and caches tasks (build/lint/test) across the workspace.
- **pnpm** — the package manager; its catalog is the single source of truth for versions.
- **typescript** — the language; `strict` everywhere.
- **eslint** + **typescript-eslint** (+ React / a11y / import / turbo plugins) — linting.
- **prettier** (+ import-sort & tailwind plugins) — formatting.
- **dotenv-cli** — loads `.env` for scripts and tests.

**Web app (`apps/nextjs`)**

- **next** — the React web framework (App Router; `^16` for Payload v3).
- **react** / **react-dom** — the UI runtime.
- **@supabase/ssr** — Supabase auth/session in Next server code + middleware (cookie-based).
- **@supabase/supabase-js** — the Supabase client (DB, Auth, Storage).
- **@tanstack/react-query** — data fetching, caching, and mutations for the shared hooks.
- **@t3-oss/env-nextjs** — validated, typed environment variables at build/runtime.
- **react-hook-form** + **@hookform/resolvers** — forms, bound to zod validators.
- **zod** — schema validation (env, form input, API payloads).
- **radix-ui** — accessible UI primitives that shadcn/ui builds on.
- **class-variance-authority**, **tailwind-merge** — component variants + class merging.
- **lucide-react**, **@tabler/icons-react** — icon sets used by the UI.
- **sonner** — toast notifications. **vaul** — the paywall drawer. **next-themes** — dark/light mode.
- **tw-animate-css** — Tailwind animation utilities. **jiti** — runtime TS for config loading.

**Mobile app (`apps/expo`)**

- **expo** + **expo-router** — the mobile framework and file-based routing.
- **react-native** — the mobile runtime.
- **nativewind** + **react-native-css** — Tailwind-style styling on native.
- **@react-native-async-storage/async-storage** — persists the auth session.
- **expo-secure-store** — secure key/value storage.
- **expo-web-browser** + **expo-linking** — the OAuth deep-link flow.
- **expo-notifications** + **expo-device** — push registration + device checks.
- **expo-constants**, **expo-status-bar**, **expo-system-ui**, **expo-splash-screen**, **expo-dev-client** — Expo essentials.
- **react-native-gesture-handler**, **react-native-reanimated**, **react-native-screens**, **react-native-safe-area-context**, **react-native-worklets** — navigation + animation deps.
- **@legendapp/list** — a performant list component. **react-native-url-polyfill** — `URL` polyfill needed by supabase-js.

**Backend, payments & AI**

- **@supabase/supabase-js** — also used by edge functions and the RLS tests.
- **stripe** — the Stripe server SDK (Checkout, customer portal, webhook).
- **ai** — the Vercel AI SDK; sends model calls through the AI Gateway.

**Content (Payload CMS — web/server only)**

- **payload** — the headless CMS (admin UI, collections, access-control, REST/Local API).
- **@payloadcms/next** — mounts Payload's admin + REST inside the Next.js app.
- **@payloadcms/db-postgres** — the Postgres adapter (targets the dedicated `cms` schema).
- **@payloadcms/storage-s3** — stores uploads in the Supabase Storage `cms-media` bucket.
- **@payloadcms/richtext-lexical**, **@payloadcms/plugin-seo** — rich-text editor + SEO fields.
- **sharp** — image processing for uploads (pulls a transitive **LGPL** `sharp-libvips`,
  which `license:check` allows as weak copyleft).

**Shared internal packages** (`@acme/*`) — `api` (data layer), `app` (validators/hooks/logic),
`cms` (generated Payload content types), `ui` (tokens/theme), `config` (env schema + constants).
Not published; imported by the apps.

**Testing & quality**

- **vitest** — unit/integration tests. **@playwright/test** — web end-to-end tests.
- **@tailwindcss/postcss**, **postcss**, **tailwindcss** — the styling build.

Run `pnpm licenses list --prod` for the full resolved tree and license of every
transitive package.

## Contributing

Contributions are welcome. The repo is a Turborepo monorepo; work happens on a
branch and lands via pull request.

**Before you open a PR**, run the gates on **Node 22** (`nvm use`) and make sure
they're green:

```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm test     # always
pnpm -F @acme/nextjs build                   # if you touched the web app
pnpm license:check                           # if you added/updated dependencies
pnpm test:rls                                # if you changed schema or RLS  (needs supabase start)
```

Also, when relevant:

- **Env vars:** update **both** `.env.example` and the zod schema in `packages/config`.
- **Database:** add a **new** migration (never edit a shipped one), reseed, and
  run `pnpm db:gen-types`. Add an FK index for any column used in an RLS policy.
- **Features:** follow the recipe in [`CLAUDE.md`](./CLAUDE.md) and keep cross-platform
  logic in `packages/`.
- **Docs:** update the README / `docs/ARCHITECTURE.md` / `docs/ERD.md` if behavior or structure changed.

**Opening the pull request**

1. Branch off `main`: `git checkout -b feat/<short-name>` (or `fix/…`, `docs/…`).
2. Commit using [Conventional Commits](https://www.conventionalcommits.org/) (e.g.
   `feat(reminders): add weekly cadence`).
3. Push and open the PR (`gh pr create` or the GitHub UI). In the description, cover
   **what** changed and **why**, how you tested it, screenshots for UI changes, and
   `Closes #<issue>` to link an issue.
4. Make sure CI is green — every PR runs lint, format, typecheck, unit, license, and
   the Supabase integration job (`test:rls` + Playwright).

## Reporting issues

Use **GitHub Issues** for bugs and feature requests:

1. **Search first** — someone may have already reported it.
2. **Open a new issue** and include: what you expected vs. what happened, exact
   **steps to reproduce**, your environment (OS, `node -v`, `pnpm -v`, web or mobile,
   local or deployed), and any relevant logs/screenshots. Note whether it's web,
   mobile, or backend.

**Security vulnerabilities:** please do **not** open a public issue. Use GitHub's
**private vulnerability reporting** (the repo's *Security → Report a vulnerability*
tab) or email the maintainers, and allow time for a fix before public disclosure.

## License

**Apache License 2.0** — see [`LICENSE`](./LICENSE). Copyright © 2026 Vyten LLC.

This repository incorporates third-party open-source software; required attributions
(the **MIT** create-t3-turbo base with its pinned upstream commit SHA, and the
**Apache-2.0** Vercel AI SDK) are in [`NOTICE`](./NOTICE). `pnpm license:check` runs in
CI and fails on strong copyleft (GPL/AGPL/SSPL); it allows permissive licenses plus
weak, file-level copyleft (LGPL/MPL) that is safe to depend on.
