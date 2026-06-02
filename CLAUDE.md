# CLAUDE.md — working agreement for this repo

Guidance for Claude Code (and humans) extending the **Dream Starter Kit**.
Read this first, then `docs/ARCHITECTURE.md` and `docs/ERD.md` — those two are the
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
| Data layer (client + generated types) | `@supabase/supabase-js` typed client, session provider | `packages/api` |
| Shared features | cross-platform validators, react-query hooks, logic | `packages/app` |
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
   policies scoped to `(select auth.uid())`. See `docs/ERD.md`.
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

## How to add a modular feature

Features in this kit are **modular**: each one spans the same predictable set of
layers, every layer lives in a predictable place, and a feature can be added — or
deleted — without touching unrelated code. The `projects → items` feature is the
working reference; copy its shape. (The AI assistant, reminders, and notifications
are all built this same way.)

### The anatomy of a feature

A feature is a vertical slice through these layers. Build them in this order:

| # | Layer | Lives in | What goes here |
|---|---|---|---|
| 1 | **Schema + RLS** | `supabase/migrations/*.sql` | the table(s), RLS policies, FK indexes |
| 2 | **Seed** | `supabase/seed.sql` | demo rows for **two** users (so isolation is testable) |
| 3 | **DB types** | `packages/api` (generated) | `pnpm db:gen-types` — never hand-edit |
| 4 | **Validators** | `packages/app/src/validators` | zod schemas for create/update input |
| 5 | **Hooks** | `packages/app/src/hooks` | react-query hooks over the typed client |
| 6 | **Web UI** | `apps/nextjs/src/app/(app)/…` | shadcn + react-hook-form, calls the hooks |
| 7 | **Native UI** | `apps/expo/src/app/(app)/…` | react-native-reusables, calls the same hooks |
| 8 | **Server (only if needed)** | `apps/nextjs/src/app/api` or `supabase/functions` | privileged work (Stripe, AI, cron) |
| 9 | **Tests** | `packages/app` + `tooling/rls-tests` + `tooling/web-e2e` | unit + RLS isolation + e2e |

Layers 4–5 are shared by **both** apps — that's the whole point. Keep `apps/*`
thin: a screen wires a hook to platform UI and nothing more.

### Worked example — adding a `tasks` feature

**1. Migration (schema + RLS + indexes).** `supabase migration new add_tasks`:

```sql
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

-- Owner-only: copy this canonical pattern from docs/ERD.md / existing tables.
create policy "tasks owned by user"
  on public.tasks for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- REQUIRED: B-tree index on every FK used in an RLS predicate.
create index tasks_user_id_idx on public.tasks (user_id);
```

Add demo rows for **both** seed users in `supabase/seed.sql`, then `supabase db reset`.

**2. Types.** `pnpm db:gen-types` regenerates `packages/api`'s `Database` type.
Use `Tables<'tasks'>`, `TablesInsert<'tasks'>`, `TablesUpdate<'tasks'>` downstream.

**3. Validators** (`packages/app`), imported as `zod/v4`:

```ts
import { z } from "zod/v4";
export const createTaskSchema = z.object({ title: z.string().min(1).max(200) });
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
```

**4. Hooks** (`packages/app`) — shared by web + native, using `useSupabase()` from `@acme/api`:

```ts
export function useTasks() {
  const supabase = useSupabase();
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async () =>
      (await supabase.from("tasks").select("*").order("created_at")).data ?? [],
  });
}
// + useCreateTask / useUpdateTask / useDeleteTask (mutations that invalidate ["tasks"])
```

**5. UI.** Web screen under `apps/nextjs/src/app/(app)/tasks` (shadcn + react-hook-form
with `standardSchemaResolver(createTaskSchema)`); native screen under
`apps/expo/src/app/(app)/tasks.tsx` (react-native-reusables). Both call the hooks
from step 4 — no data logic in the screens. Add the route to the web sidebar /
native home nav.

**6. Tests (required).**
- Vitest unit test for `createTaskSchema` (and any non-trivial pure logic).
- Extend `tooling/rls-tests`: assert user B **cannot** read or write user A's tasks.
- If it's a critical flow, add/extend a Playwright spec in `tooling/web-e2e`.

**7. Verify + commit.** `pnpm typecheck && pnpm lint && pnpm test` green
(+ `next build` / `expo export` if you touched those), then a scoped commit:
`feat(tasks): add task list`.

### Keeping features modular (and removable)

- **One feature = one vertical slice.** Don't scatter a feature's logic across
  unrelated files. A cloner should be able to delete a feature by removing its
  migration (well, adding a drop migration), its validator/hook files, its two
  screens, its nav entries, and its tests — and nothing else should break.
- **Gate optional features behind data, not forks.** Premium is unlocked by
  reading `subscriptions` (`usePremium()`), not by build flags. Follow that pattern.
- **Never edit a shipped migration.** Add a new one (rename/drop included).
- **Touching env or constants?** Update `.env.example` **and** the zod schema in
  `packages/config`; put shared constants (model id, prices, limits) in `packages/config`.

To rename the example domain (`projects`/`items`) to your own nouns, see the
README → "The example feature & renaming it" — it's a find-and-replace plus a
new migration.

## Conventions

- **TypeScript everywhere**, `strict`. No `any` without a reason.
- **Commits:** Conventional Commits, one per phase/feature
  (`feat(backend): ...`, `fix(auth): ...`).
- **Keep it buildable.** typecheck + lint must pass at every checkpoint.
- **Env changes** always touch both `.env.example` and the zod schema.
- **Migrations are append-only and idempotent-friendly.** Never edit a shipped
  migration; add a new one.
- **Don't track create-t3-turbo upstream** (see `docs/ARCHITECTURE.md` → Keeping
  dependencies current): snapshot + cherry-pick only. The forked SHA is in `NOTICE`.

## Status

The kit is **feature-complete and ready to clone**: auth, the example data feature,
billing, the AI assistant, engagement (notifications/reminders/push), and the full
test/CI suite are all built and green. Extend it with the modular-feature recipe
above, keep every checkpoint green (`pnpm typecheck && pnpm lint && pnpm test`), and
update this file when conventions change.
