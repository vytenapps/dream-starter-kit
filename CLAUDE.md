# CLAUDE.md — working agreement for this repo

Guidance for Claude Code (and humans) extending the **Meet Dream Starter Kit**.
Read this first, then `ARCHITECTURE.md` and `ERD.md` — those two are the
**source of truth**. If anything here conflicts with them, they win.

## What this is

A clone-and-ship starter: one Turborepo monorepo that ships a **Next.js web app**
and an **Expo (iOS + Android) app** sharing **one Supabase backend**. A founder
clones it and extends it (with you) into a real product. So: keep it
**runnable end-to-end**, **clean**, and **well-documented**. Correctness and
clarity beat cleverness.

## Stack (and where each lives)

| Concern | Choice | Location |
|---|---|---|
| Monorepo | Turborepo + pnpm (forked from create-t3-turbo) | root |
| Web | Next.js (App Router), shadcn/ui, Tailwind | `apps/nextjs` |
| Mobile | Expo + Expo Router, react-native-reusables, NativeWind | `apps/expo` |
| Backend | Supabase: Postgres + Auth + Storage + Edge Functions | `supabase/` |
| Data layer | `@supabase/supabase-js` typed client + react-query hooks | `packages/api` |
| Shared features | cross-platform screens/hooks/logic | `packages/app` |
| Shared UI tokens / primitives | | `packages/ui` |
| Env + constants | zod env schema, `DEFAULT_AI_MODEL`, etc. | `packages/config` |
| Payments | Stripe (web only) + webhook edge function | `apps/nextjs`, `supabase/functions` |
| AI | Vercel AI SDK v6 via the AI Gateway (Claude default) | server routes / edge fn |
| Build/ship | EAS (mobile), Vercel (web), Expo Push | `eas.json`, Vercel |

> Package scope is `@acme/*` (inherited from the template). It's renameable —
> see the README. Don't rename mid-build.

## The golden rules (do not violate)

1. **RLS on every table.** Authorization lives in Postgres, not app code. Every
   table has an owner (`user_id`/`owner_id`, or reachable via `memberships`) and
   policies scoped to `(select auth.uid())`. See `ERD.md`.
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

## How to add a feature (the recipe)

Follow this every time — it keeps the kit secure and consistent. Example: adding
a `tasks` table.

1. **Schema + RLS + indexes (migration).** New SQL file in
   `supabase/migrations/` (`supabase migration new add_tasks`):
   - create the table with an owner column (`user_id` or `project_id` → org).
   - `alter table tasks enable row level security;`
   - add the owner policy (copy the canonical pattern from `ERD.md` /
     existing tables) using `(select auth.uid())`.
   - **add a B-tree index on every FK used in RLS predicates** (e.g.
     `create index on tasks (user_id);`). RLS filters need these.
   - add demo rows to `supabase/seed.sql` (for two users, so isolation is
     testable). Run `supabase db reset`.
2. **Types.** Regenerate DB types: `pnpm db:gen-types` (writes
   `packages/api`’s generated types). Never hand-edit generated types.
3. **Validators.** zod schema for create/update input (co-locate with the
   feature in `packages/app` or `packages/api`).
4. **Data hooks.** Add react-query hooks in `packages/api` (`useTasks`,
   `useCreateTask`, …) using the typed client. These are shared by web + native.
5. **UI.** Web screen in `apps/nextjs` (shadcn + react-hook-form + zod). Native
   screen in `apps/expo` (react-native-reusables). Share logic via
   `packages/app`; keep platform UI thin.
6. **Tests (required).**
   - Vitest unit test for the validator + any non-trivial hook logic.
   - Extend `pnpm test:rls`: assert user B cannot read/write user A's tasks.
   - If it's a critical user flow, add/extend a Playwright spec.
7. **Verify the gate:** `pnpm typecheck && pnpm lint && pnpm test` green, then
   commit with a scoped message (`feat(tasks): ...`).

To rename the example domain (`projects`/`items`) to your nouns, see the README
"Rename the example feature" section (the full README is finalized in Phase 9) —
it's a find-and-replace plus a migration.

## Conventions

- **TypeScript everywhere**, `strict`. No `any` without a reason.
- **Commits:** Conventional Commits, one per phase/feature
  (`feat(backend): ...`, `fix(auth): ...`).
- **Keep it buildable.** typecheck + lint must pass at every checkpoint.
- **Env changes** always touch both `.env.example` and the zod schema.
- **Migrations are append-only and idempotent-friendly.** Never edit a shipped
  migration; add a new one.
- **Don't track create-t3-turbo upstream** (ARCHITECTURE.md §9.3): snapshot +
  cherry-pick only. The forked SHA is pinned in `NOTICE`.

## Build status

This kit is built in phases (see `ARCHITECTURE.md` and the repo task list):
0 scaffold · 1 Supabase layer · 2 schema+RLS · 3 auth · 4 example feature ·
5 billing · 6 AI · 7 engagement · 8 testing/CI · 9 polish. Each phase ends
"builds clean + committed". Update this file when conventions change.
