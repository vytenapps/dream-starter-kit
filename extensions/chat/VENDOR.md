# Vendored: vercel/ai-chatbot (Chat SDK)

`src/vendor/**` is a snapshot of [vercel/ai-chatbot](https://github.com/vercel/ai-chatbot)
(the "Chat SDK" Next.js template) — the streaming chat UI, AI Elements, and the
artifacts suite. It powers `/a/chat`. Apache-2.0 (see root `NOTICE`).

- **Upstream commit:** `2becdb4a56e7683ae08aef927cec1c6c52dfad5e` (2026-06-12)
- **Upstream layout mirrored 1:1** under `src/vendor/`:
  `components/{ai-elements,chat,ui}`, `hooks`, `lib`, `artifacts`.

## Why vendored

The Chat SDK is a template, not a library — there's no npm package to depend on.
Vendoring lets us patch it against the kit's Supabase backend + AI Gateway while
keeping the option to re-snapshot upstream as a clean diff.

## Re-snapshotting upstream

1. `git clone --depth 1 https://github.com/vercel/ai-chatbot /tmp/ai-chatbot`
2. Copy the trees back over `src/vendor/` (components/{ai-elements,chat,ui},
   hooks, lib, artifacts). Do **not** copy `app/`, `lib/db/{schema,queries,migrate}.ts`,
   `lib/db/migrations`, `lib/ratelimit.ts`, `lib/ai/entitlements.ts`,
   `lib/ai/models.mock.ts`, `*.test.ts`, or the auth/sidebar components listed
   under "Deleted" below.
3. Re-apply the mechanical rewrites, then the hand adaptations, then
   `pnpm typecheck && pnpm lint` in this package and `pnpm -F @acme/nextjs build`.

### Mechanical rewrites (re-runnable)

- **Imports:** upstream uses `@/…` path aliases. We use **relative imports**
  (Turbopack doesn't resolve a package.json `imports`/`#` map through a
  transpiled workspace package — tsc does, the bundler doesn't, so relative is
  the portable choice). Rewrite `@/{components,hooks,lib,artifacts}/X` →
  the correct relative path into `src/vendor/…` (a small Python codemod by file
  depth; see the project history for the script).
- `from "framer-motion"` → `from "motion/react"`.
- `import cx from "classnames"` / `import cn from "classnames"` →
  `import { clsx as cx/cn } from "clsx"`.
- URL bases: `${NEXT_PUBLIC_BASE_PATH}/api/…` → `${API_BASE}/…`, `/api/chat` →
  `/stream`, `/api/chat?id=` → `/thread?id=`, `/chat/<id>` → `${CHAT_PATH}/<id>`
  (constants in `src/vendor/lib/constants.ts`).
- `zod` v3 → `zod/v4` in the one ported schema file.

### Hand adaptations (kit-specific — re-apply after a re-snapshot)

- **DB:** `lib/db/schema.ts` is plain types (not Drizzle); `lib/db/queries.ts`
  runs every query through a passed-in RLS-scoped Supabase client against the
  `ext_chat_*` tables, mapping snake_case → camelCase. Messages persist both
  structured `parts` and a plain-text `content` projection (native screens read
  `content`).
- **Auth:** `next-auth` `Session` → `ToolSession` (`lib/types.ts`): `{ user: { id },
  db }`. Tool/document-handler DB calls take `session.db`. Authorization is RLS,
  not app-code ownership checks.
- **Models:** `lib/ai/models.ts` + `providers.ts` read `@acme/config`
  (`CHAT_MODELS`/`DEFAULT_AI_MODEL`/`ROUTING_AI_MODEL`) — gateway slugs live only
  there (golden rule #5). Per-model gatewayOrder/capability probes dropped.
- **Routes:** the upstream `app/(chat)/api/*` handlers are re-expressed as the
  dispatcher route table in `src/server/index.ts` (ids via query strings).
- **Storage:** `/files/upload` uses the `chat-uploads` Supabase bucket (host
  migration) + signed URLs, not Vercel Blob.
- **Toast:** `components/chat/toast.tsx` re-exports `@acme/ui/toast`'s `toast`.
- **CSS:** upstream `app/globals.css` editor/animation extras live in
  `src/vendor/styles.css`, imported by the chat screen.

### Deleted (not vendored)

`components/{chat/app-sidebar,chat/sidebar-toggle,chat/sidebar-user-nav,chat/auth-form,chat/sign-out-form}.tsx`,
`components/ui/sidebar.tsx` (the host shell owns the app sidebar),
`components/theme-provider.tsx`, and the redis-backed resumable-stream path
(`use-auto-resume` is a no-op stub).

### Stubbed for this phase

- **Public chat sharing / visibility** — `use-chat-visibility` returns private;
  the column exists for forward-compat.
- **Resumable streams** — need redis.
- **Image artifacts** — render + DB kind kept, but no image-generation handler
  is registered (no gateway image model wired yet).

## Lint / typecheck

`src/vendor/**` has relaxed stylistic/strictness ESLint rules (see
`eslint.config.ts`) so the snapshot stays close to upstream; bundle-safety rules
still apply. `lib/editor/diff.js` carries `// @ts-nocheck` (upstream JS).
