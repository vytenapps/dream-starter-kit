# Meet Dream Starter Kit

A clone-and-ship starter: one **Turborepo** monorepo shipping a **Next.js web app**
and an **Expo (iOS + Android) app** that share **one Supabase backend**
(Postgres + Auth + Row-Level Security + Storage + Edge Functions). Stripe billing,
a Vercel-AI-Gateway assistant, and Expo push notifications are wired in. Clone it,
rename a few things, and extend it into a real product.

### What you get out of the box

- **Auth** — email/password, magic link, Google & Apple OAuth (Supabase Auth), with
  protected routes on web + native and account deletion.
- **A real data feature** — `projects → items` CRUD on web *and* native from one set
  of shared react-query hooks, fully protected by Row-Level Security. This is the
  reference pattern you copy for your own nouns.
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

- **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** — stack, structure, decisions, dependency/upgrade policy, licenses.
- **[`ERD.md`](./ERD.md)** — data model + the canonical RLS pattern every table follows.
- **[`CLAUDE.md`](./CLAUDE.md)** — working agreement, the golden security rules, and the "how to add a feature" recipe.

If anything here disagrees with those, **they win.**

## Stack

| Layer | Choice |
|---|---|
| Monorepo | Turborepo + pnpm (forked from create-t3-turbo) |
| Web | Next.js (App Router, Turbopack) · shadcn/ui · Tailwind |
| Mobile | Expo + Expo Router · react-native-reusables · NativeWind |
| Backend | Supabase — Postgres + Auth + RLS + Storage + Edge Functions (Deno) |
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

## Quickstart (local)

```bash
git clone <your-fork-url> && cd dream-starter-kit
nvm use                       # Node 22.21.0
pnpm install
cp .env.example .env          # see "Environment variables" below

supabase start                # local Postgres/Auth/Storage (Docker); prints URL + keys
supabase db reset             # apply migrations + seed.sql (two demo users)
# paste the printed API URL + anon + service_role keys into .env

pnpm dev:next                 # web only  →  http://localhost:3000
pnpm dev                      # web + mobile together (turbo watch)
```

Demo logins (from `supabase/seed.sql`, local only): `user.a@example.com` /
`user.b@example.com`, password `password123`. User A has an active Pro subscription.

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
| `NEXT_PUBLIC_APP_URL` / `EXPO_PUBLIC_API_URL` | ✅ | your web origin (LAN IP in mobile dev) |
| `AI_GATEWAY_API_KEY` | 🔒 | [Vercel AI Gateway](https://vercel.com/ai-gateway) (auto on Vercel) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | 🔒 | Stripe Dashboard / `stripe listen` |
| `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY` | 🔒 | Stripe price IDs (`price_…`) |
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
apps/expo          # mobile — Expo Router, react-native-reusables (thin entry point)
packages/api       # Supabase data layer: typed client, generated DB types, react-query hooks
packages/app       # cross-platform features: zod validators, hooks, pure logic (shared web+native)
packages/ui        # shared UI tokens/primitives + theme/toast
packages/config    # zod env schema + constants (DEFAULT_AI_MODEL, PLANS, rate limit)
supabase/          # migrations (schema + RLS), seed.sql, edge functions, config.toml
tooling/           # eslint / prettier / tailwind / tsconfig + rls-tests + web-e2e + CI setup
```

**Cross-platform logic lives in `packages/`; `apps/*` are thin.** New data features
follow the recipe in `CLAUDE.md` (migration + RLS + FK index → types → validator →
hook → web & native UI → tests).

## The example feature & renaming it

`projects → items` is the reference feature. To make it yours (e.g. `boards → cards`):

1. Find-and-replace `project`/`projects` and `item`/`items` (respect casing) across
   `packages/app`, `packages/api`, `apps/nextjs`, `apps/expo`.
2. Add a **new** migration renaming the tables/policies/indexes (migrations are
   append-only — never edit a shipped one), then `supabase db reset`.
3. Regenerate DB types: `pnpm db:gen-types`.
4. Update the seed and the RLS regression (`tooling/rls-tests`) and Playwright specs.
5. `pnpm typecheck && pnpm lint && pnpm test`.

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

### Backend (Supabase)

```bash
supabase link --project-ref <your-ref>
supabase db push                          # apply migrations to the hosted project
supabase functions deploy stripe-webhook  # + delete-account, process-reminders
supabase secrets set STRIPE_SECRET_KEY=… STRIPE_WEBHOOK_SECRET=… CRON_SECRET=…
```

Enable OAuth providers and set redirect URLs in the Supabase Dashboard (Auth →
Providers / URL Configuration). Schedule `process-reminders` (pg_cron / a scheduler)
with the `CRON_SECRET` in the `Authorization` header.

### Web (Vercel)

Import the repo, set the root to `apps/nextjs`, add the env vars above (the AI Gateway
credential is injected automatically). Add a Stripe webhook endpoint pointing at the
deployed `stripe-webhook` function and copy its signing secret into Supabase secrets.

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

## License

**MIT** — see [`LICENSE`](./LICENSE). Copyright © Vyten LLC.

Third-party attributions (the MIT create-t3-turbo base — pinned upstream SHA — and the
Apache-2.0 Vercel AI libraries) are in [`NOTICE`](./NOTICE). `pnpm license:check` keeps
the dependency tree free of strong copyleft.
