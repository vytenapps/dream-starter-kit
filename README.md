# Meet Dream Starter Kit

A clone-and-ship starter: one Turborepo monorepo shipping a **Next.js web app**
and an **Expo (iOS + Android) app** that share **one Supabase backend**
(Postgres + Auth + Row-Level Security + Storage), with Stripe billing and AI
built in. Clone it, then extend it into a real product.

> **Status: under active construction.** Built in phases (see `ARCHITECTURE.md`
> and `CLAUDE.md`). Done so far: **Phase 0** (scaffold) and **Phase 1**
> (Supabase backend layer). This README is finalized in Phase 9 — until then,
> the authoritative docs are below.

## Source of truth

- **`ARCHITECTURE.md`** — stack, structure, decisions, dependency/upgrade policy, licenses.
- **`ERD.md`** — data model + the canonical RLS pattern.
- **`CLAUDE.md`** — working agreement, golden rules, and the "how to add a feature" recipe.

## Stack

Turborepo · Next.js (App Router) + shadcn/ui · Expo + Expo Router + NativeWind ·
Supabase (Postgres/Auth/RLS/Storage/Edge Functions) · Stripe (web) ·
Vercel AI SDK v6 via the AI Gateway (Claude default) · EAS + Expo Push · Vercel.

## Prerequisites

- **Node 22** (`.nvmrc` pins `22.21.0` — run `nvm use`) and **pnpm 10**.
- **Supabase CLI** + Docker (for local Postgres/Auth/Storage).
- Service accounts (free tiers): **Supabase, Vercel, Expo (EAS), Stripe**.
  AI runs through the Vercel AI Gateway — no separate AI-provider signup.

## Quickstart

```bash
nvm use                 # Node 22.21.0
pnpm install
cp .env.example .env     # then fill in values

supabase start           # local Postgres/Auth/Storage (Docker); prints keys
# paste the printed anon/service_role keys + URL into .env

pnpm dev                 # run web + mobile (turbo watch)
pnpm dev:next            # web only  →  http://localhost:3000
```

Quality gates (run before committing):

```bash
pnpm typecheck && pnpm lint && pnpm test
```

## Repo structure

```
apps/nextjs   # web (Next.js App Router)
apps/expo     # mobile (Expo Router)
packages/api  # Supabase data layer: typed client, generated types, react-query hooks
packages/ui   # shared UI primitives (shadcn)
packages/config # zod env schema + constants (DEFAULT_AI_MODEL, …)
supabase/     # migrations, edge functions, seed (schema + RLS land in Phase 2)
```

## Environment & security

Every variable is validated by a zod schema (`packages/config/env` + each app's
`env.ts`); the app fails loudly if a required one is missing. `NEXT_PUBLIC_*` /
`EXPO_PUBLIC_*` are compiled into the client and must hold only anon/publishable
values. The Supabase **service role key is server-only** (edge functions /
server code) and never reaches the client or mobile bundle. See `.env.example`.

## License

MIT — see [`LICENSE`](./LICENSE). Upstream attributions (the MIT create-t3-turbo
base and the Apache-2.0 Vercel AI libraries) are in [`NOTICE`](./NOTICE).
