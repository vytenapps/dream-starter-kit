# @acme/web-e2e — Playwright end-to-end tests

Browser tests for the web app, run against a **live local Supabase** + the Next.js
app. CI provisions both automatically (see `.github/workflows/ci.yml` → the
`integration` job); the steps below are for running them on your machine.

## Run locally

```bash
# 1. Boot the local backend (Postgres + Auth + Storage) and apply migrations + seed
supabase start
supabase db reset            # applies supabase/migrations + supabase/seed.sql

# 2. Point .env at the local stack (copy the keys `supabase start` printed)
#    NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY

# 3. Install the browser once
pnpm --filter @acme/web-e2e exec playwright install --with-deps chromium

# 4. Run the suite (Playwright starts `next dev` for you and reuses it if already up)
pnpm test:e2e
```

Local Supabase runs with email confirmations **off**, so sign-up lands straight
on the dashboard and the seeded accounts (`user.a@example.com` / `password123`)
can sign in immediately.

## What's covered

| Spec                    | Flow                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `smoke.spec.ts`         | Landing renders; a protected route redirects signed-out users to `/sign-in` (with `redirectTo`). |
| `auth.spec.ts`          | Seeded password sign-in → dashboard; a signed-in user is bounced away from auth pages.           |
| `critical-path.spec.ts` | Sign up → create a project → add an item (the reference RLS-backed CRUD flow).                   |

## Deliberately not covered here

- **Billing / paywall checkout** — completing a subscription redirects to Stripe's
  hosted checkout, which needs Stripe **test-mode** keys + `stripe listen` for the
  webhook. RLS read-own of `subscriptions` and the gating helper are unit/RLS
  tested instead; add a `paywall.spec.ts` once you wire test-mode Stripe.
- **AI chat round-trip** — sending a message needs a real `AI_GATEWAY_API_KEY`
  (not present in CI). Thread/message persistence + isolation are covered by the
  RLS regression (`pnpm test:rls`); add a `chat.spec.ts` with a mocked or
  test-keyed model when you want full coverage.

These are intentional extension points, not bugs — the security-critical paths
(auth, route protection, RLS isolation, CRUD) all run in CI on every PR.
