# Dream Starter Kit — Architecture

> One monorepo → a **Next.js web app** and an **Expo (iOS + Android) app** that
> share **one Supabase backend**. This document explains how the pieces fit
> together, as the kit is actually built.
>
> **License:** Apache-2.0 — see [`LICENSE`](../LICENSE) and [`NOTICE`](../NOTICE).
> **Data model:** see [`ERD.md`](./ERD.md). **Conventions & recipes:** [`CLAUDE.md`](../CLAUDE.md).

---

## 1. What this is (in plain terms)

A founder clones this repo and gets a working product skeleton for web **and**
mobile that already handles the boring-but-essential parts: sign-up/login,
a database with per-user security, subscriptions, an AI assistant, and push
notifications. You replace the example feature with your own and ship.

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
| Authorization | Postgres **Row-Level Security** on every table |
| Data layer | `@supabase/supabase-js` typed client + react-query hooks |
| Payments | Stripe (web subscriptions) + a webhook edge function |
| AI | Vercel AI SDK v6 through the **Vercel AI Gateway** (Claude default) |
| Mobile build / submit / push | Expo EAS + Expo Push |
| Web hosting | Vercel |
| Optional polish | `liquid-glass-react` (one web hero accent, Chromium-only) |

---

## 3. Repository structure

```
dream-starter-kit/
├─ apps/
│  ├─ nextjs/                # web — Next.js App Router (thin entry point)
│  └─ expo/                  # mobile — Expo Router → iOS + Android (thin entry point)
├─ packages/
│  ├─ api/                   # Supabase client, generated DB types, session provider
│  ├─ app/                   # shared features: zod validators, react-query hooks, pure logic
│  ├─ ui/                    # shared UI tokens/primitives + theme/toast
│  └─ config/                # zod env schema + constants (DEFAULT_AI_MODEL, PLANS, rate limit)
├─ supabase/
│  ├─ migrations/            # SQL schema + RLS policies (implements ERD.md)
│  ├─ functions/             # edge functions: stripe-webhook, delete-account, process-reminders
│  ├─ seed.sql               # demo data (two users) for local dev + tests
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

The landing page, auth pages, the signed-in dashboard, the example feature, the
paywall, the AI chat, and the server API routes (AI proxy, Stripe checkout/portal,
push test). UI is built from **shadcn/ui** components (Radix + Tailwind) copied
into `apps/nextjs/src/components/ui`.

### 4.3 Mobile app — Expo + Expo Router

The iOS/Android app. File-based routing mirrors the web (`(auth)` and `(app)`
route groups). UI uses **react-native-reusables** (the shadcn philosophy for
React Native) styled with **NativeWind**, so web and native look consistent.
Built and shipped with EAS ([§4.10](#410-build--ship)).

### 4.4 Shared packages — the reusable core

- **`@acme/api`** — the typed Supabase client, generated database types, the
  session provider, and the react-query query client. The single way the apps
  talk to the backend.
- **`@acme/app`** — cross-platform feature code: zod validators, react-query
  hooks (`useProjects`, `useChat`, `useReminders`, …), and pure helper logic.
  This is where most features live; both apps import from here.
- **`@acme/ui`** — shared design tokens, the theme provider, toasts, and the
  `cn` class helper.
- **`@acme/config`** — the zod environment schema and shared constants
  (`DEFAULT_AI_MODEL`, the `PLANS` pricing, AI token cap, the rate-limit window).

> The package scope is `@acme/*`, inherited from the scaffold. It's renameable
> (see the README) — but rename once, before building features.

### 4.5 Backend — Supabase

One Supabase project provides Postgres, **Supabase Auth** (email/password, magic
link, Google & Apple OAuth), Storage, and **Edge Functions** (Deno). The schema
and the canonical security pattern live in [`ERD.md`](./ERD.md) and are applied
by the SQL files in `supabase/migrations/`.

Three edge functions run server-side with the service-role key:
- **`stripe-webhook`** — verifies Stripe signatures and syncs billing state.
- **`delete-account`** — verifies the caller, then deletes their auth user
  (the database cascades clean-up) and cancels any live Stripe subscription.
- **`process-reminders`** — a scheduled job that turns due reminders into
  notifications and push messages.

### 4.6 Security model (the non-negotiables)

This is the part a founder most needs to get right, so it's enforced structurally:

- **RLS on every table.** Authorization is in Postgres, not app code. Every table
  has an owner (`user_id`, or reachable through `memberships`) and policies that
  scope rows to the signed-in user (`auth.uid()`). A bug in app code cannot leak
  another user's data. There's an automated test (`pnpm test:rls`) that proves
  one user can't read or write another's rows.
- **The service-role key is server-only.** It bypasses RLS and appears *only* in
  edge functions / server code — never in the web client or the mobile bundle.
- **Secrets go through a zod env schema.** Every variable is validated on boot
  (`packages/config` + each app's `env.ts`); the app fails loudly if one is
  missing. `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` are public (compiled into the
  client) and hold only anon/publishable values; everything else is server-only.

### 4.7 Payments — Stripe (web)

Subscriptions are sold on the **web** with Stripe Checkout + the customer portal.
The `stripe-webhook` edge function (signature-verified, idempotent) syncs the
product/price catalog and subscription status into the database. There is one
**Pro** plan with two prices — **$9.99/mo** and **$99/yr**.

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
`process-reminders` edge function (run on a schedule) finds due reminders and
sends notifications + push. A web notification bell and a native header bell
surface unread items.

### 4.10 Build & ship

- **Mobile:** Expo **EAS Build** (cloud builds, no local native toolchain) +
  **EAS Submit**. Profiles (`dev`/`preview`/`production`) are in `apps/expo/eas.json`.
- **Push:** **Expo Push** (free). Remote push requires a **dev build on a physical
  device** — Expo Go can't receive it on Android (SDK 53+).
- **Web:** Vercel (preview deploys, edge, SEO). Fastest setup is the one-click deploy
  plus the Supabase Marketplace integration (it auto-injects the Supabase env) — see
  the README's Deploy section.

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
| Expo SDK + `expo-*` + React Native | `expo install --fix` + the Expo SDK upgrade guide (let Expo own native-compatible versions) |
| shadcn/ui & react-native-reusables | re-run the registry add (`pnpm ui-add <component>`), diff, re-apply your edits |
| create-t3-turbo scaffold | cherry-pick discrete fixes only (not a tracked dependency) |

---

## 9. Caveats & gotchas

- **Store billing rules.** In-app digital subscriptions must use Apple/Google
  billing; this kit sells on the **web** only ([§4.7](#47-payments--stripe-web)).
- **Push needs a dev build.** Remote push doesn't work in Expo Go on Android
  (SDK 53+) — test in a dev build ([§4.10](#410-build--ship)).
- **AI model slugs change.** They live in one place (`DEFAULT_AI_MODEL`); update
  there, don't hardcode elsewhere.
- **Glass is a Chromium-only accent.** `liquid-glass-react`'s refraction shows in
  Chromium; elsewhere it degrades gracefully. Use it sparingly (it's decorative).
