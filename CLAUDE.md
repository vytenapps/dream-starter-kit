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
| Content / CMS | Payload CMS v3 (web/server only) — own `cms` schema, `/admin`, REST at `/cms-api` | `apps/nextjs/src/payload`, `packages/cms` |
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

1. **RLS on every app table.** Authorization lives in Postgres, not app code. Every
   table in the `public` schema has an owner (`user_id`/`owner_id`, or reachable via
   `memberships`) and policies scoped to `(select auth.uid())`. See `docs/ERD.md`.
   **The one allowed exception is Payload CMS**, which owns the separate `cms`
   schema and enforces its own access-control; it's contained via a dedicated
   least-privilege, server-only `payload_cms` role (no access to `public`/`auth`) —
   so it's outside RLS *by design*, not by oversight. Don't put per-user app data there.
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
deleted — without touching unrelated code. The **`reminders`** feature is the
working reference for a Supabase RLS feature; copy its shape. (The AI assistant
and notifications are built this same way.) For **editorial/marketing content**,
use Payload instead — see [How to add a Payload content type](#how-to-add-a-payload-content-type).

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

### Worked example

The in-repo reference is **`reminders`** (a single owner-scoped table: validator
`reminder.ts`, hooks `use-reminders.ts`, web + native screens, and an RLS test).
Read those files to see the real shape. The walkthrough below uses a fresh `tasks`
table so the pattern is easy to follow — `reminders` is built exactly this way.

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

The kit ships **no** example app-domain table — add your product's own per-user
tables with the recipe above. For content-type guidance, see the README and
[How to add a Payload content type](#how-to-add-a-payload-content-type) below.

## How to add a Payload content type

For **editorial/marketing content** (the same for every visitor — articles, events,
pages, …), add a **Payload collection**, not a Supabase table. Content lives in the
`cms` schema and is governed by **Payload's access-control, not RLS**.

1. **Collection.** Add a config in `apps/nextjs/src/payload/collections/` (copy
   `Articles.ts`). Set fields, `slug`, and `access` (e.g. published-or-admin reads).
2. **Register it** in `apps/nextjs/src/payload.config.ts` (`collections: [...]`).
3. **Types.** `pnpm cms:gen-types` regenerates Payload's types into `packages/cms`
   (`@acme/cms`) — never hand-edit. Then `pnpm cms:migrate:create` + `pnpm cms:migrate`
   to apply the schema change to the `cms` schema.
4. **Web page.** Add a public RSC route under `apps/nextjs/src/app/(frontend)/(public)/`
   that fetches via Payload's **Local API** (`getPayload(...).find(...)`), for SEO.
5. **Mobile.** Add a REST hook in `packages/app` (copy `use-content.ts`'s
   `useArticles`/`useEvents`), typed by `@acme/cms`, and a native screen under
   `apps/expo/src/app/(app)/content/`.
6. **No RLS, no rls-tests.** Content is access-controlled by Payload — do **not**
   add it to `docs/ERD.md` or `tooling/rls-tests`. (Add a Playwright `content.spec.ts`
   case if it's a critical public flow.)
7. **Seed it.** Add a demo row for the new collection to `seedCmsContent()` in
   `apps/nextjs/src/payload/seed.ts` (as a new ordered step) so the CMS stays "fully
   functional" out of the box. That seed runs two ways: the `pnpm cms:seed` CLI, and
   automatically the first time a staff user opens `/admin` — a `beforeDashboard` gate
   (`payload/components/SeedGate.tsx`) sends an unseeded admin to `/cms-setup`, which
   streams `/api/cms/seed` behind a shadcn progress bar, then returns to `/admin`. Keep
   steps scalar-only (no binary fixtures).

**CMS auth is SSO from Supabase — there is no second login.** Payload's local strategy
is disabled; `apps/nextjs/src/payload/auth/supabase-strategy.ts` authenticates each CMS
request from the Supabase session and provisions a `cms.users` row (linked by
`supabaseUserId`). Access is **default-deny**: only users with `profiles.is_staff = true`
get in (the first signup is auto-flagged; flip the flag to add editors). The bridge runs
in the Next.js server — it reads `profiles` via the user's own RLS session and writes
`cms.users` via the Local API — so it never uses the `payload_cms` DB role or the
service-role key (golden rules #1–2 hold). `/admin` is gated in `proxy.ts`.

## Theming (shadcn, one source of truth)

The whole surface — the web front end **and** the Payload `/admin` panel — is driven
by one shadcn theme (Tailwind v4, OKLCH tokens). Two layers:

1. **Static defaults (no-flash):** all design tokens live in **`tooling/tailwind/theme.css`**
   (`@acme/tailwind-config/theme`) — `:root` + `@variant dark`, plus the `@theme inline`
   map. This is the *only* place tokens are defined. **Do not** redefine `:root`/`.dark`
   tokens in `apps/nextjs/src/app/styles.css` (it only holds imports, variants, base layer).
2. **Runtime override (site-wide, editable):** the **`theme-settings` Payload global**
   (`payload/globals/ThemeSettings.ts`, staff-editable in `/admin`) is the authoritative
   theme. `lib/theme/serialize.ts#themeToCss` turns it into a `<style>` that overrides the
   defaults (doubled `:root:root` selector wins regardless of `<head>` order), targeting
   both `.dark` (front end) and `[data-theme="dark"]` (admin). It's injected server-side by
   `<ThemeStyle />` (front-end layout `<head>`) and `ThemeStyleProvider` (registered as
   Payload `admin.components.providers`). Defaults live in `lib/theme/defaults.ts` and
   **must mirror `theme.css`**.

The shared **app shell** (shadcn `dashboard-01`) wraps every authenticated page in
`app/(frontend)/(app)/layout.tsx` (sidebar + header); pages return content only.

**To add/change a color token:** edit `theme.css` (default) **and** `lib/theme/defaults.ts`
(`COLOR_TOKENS`, which also generates the global's fields + serializer output) — never in
`styles.css`. Fonts are a curated `next/font` set chosen at runtime via the global
(`FONT_*_OPTIONS`); their CSS vars are set on `<html>`.

**Payload admin** follows Payload's official Tailwind+shadcn guide: `(payload)/custom.css`
pulls in Tailwind **utilities without preflight** (so shadcn components work in admin
without breaking Payload's reset) and maps the shadcn tokens onto Payload's own
`--theme-*`/`--font-body` chrome variables. Token values come from `ThemeStyleProvider`.

**Editing the theme.** `theme-settings` is a **standard, versioned Payload global** — no
custom view. It lives in the **Admin** nav group under **Site Settings** and is edited with
Payload's native **Edit / API** tabs plus a **Versions** tab. Versioning is **drafts → publish**
(`versions: { drafts: true }`): the front end and admin chrome render the **published** theme, so
a draft save does not change the live site until you **Publish**. Fields are grouped in tabs
(Branding · Light · Dark · Typography · Other); branding uploads (app icon/logos) use standard
Media upload fields. Read access is `publishedOrAdmin` (anonymous visitors get the published
theme; staff see drafts); update + `readVersions` are staff-only. Pure color math lives in
`lib/theme/color.ts` (consumed by `serialize.ts`). **Branding** (app name, favicon, sidebar logo)
is read server-side by `getBranding()` (lib/payload.ts) and surfaced via `BrandingProvider`.
Serif fonts (Merriweather/Lora) are loaded on `<html>` alongside the sans/mono set.

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

The kit is **feature-complete and ready to clone**: auth, billing, the AI assistant,
engagement (notifications/reminders/push), the **Payload CMS** content backend
(articles/events/pages + admin at `/admin`), and the full test/CI suite are all built
and green. There is **no** example app-domain table — `reminders` is the reference for
adding your own. Extend it with the modular-feature recipe above, keep every checkpoint
green (`pnpm typecheck && pnpm lint && pnpm test`), and update this file when
conventions change.
