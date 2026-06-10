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

Local Supabase runs with email confirmations **ON** (matching hosted Supabase
defaults): sign-up lands on `/check-email`, and the specs complete it by pulling
the confirmation email from **Mailpit** — the mail-catcher bundled with
`supabase start`, at `http://127.0.0.1:54324` (`[inbucket]` in
`supabase/config.toml`; override with `MAILPIT_URL`). See
`src/helpers/mailpit.ts`. Changing auth config requires `supabase stop &&
supabase start` — a `db reset` alone doesn't apply it.

The kit ships an **empty seed** (no demo accounts) — the first UI signup becomes
the owner, who is routed through `/welcome` → `/cms-setup` to seed the CMS
before `/admin`; every later signup lands on the dashboard. The `setup` project
(`founder.setup.ts`) provisions that founder first (and saves their session for
`staff-invite.spec.ts`), so the parallel specs that assert "sign-up → dashboard"
run as non-staff users. Each spec uses a unique email so repeated runs against
the same DB don't collide. The staff-invite spec also needs
`SUPABASE_SERVICE_ROLE_KEY` in `.env` (the invite hook uses it).

## What's covered

| Spec                    | Flow                                                                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `founder.setup.ts`      | Setup project (runs first): founder sign-up → confirm via Mailpit link → `/cms-setup` seeds the CMS → `/admin`. Provisions the founder + seeded content the rest of the suite relies on. |
| `smoke.spec.ts`         | Landing renders; a protected route redirects signed-out users to `/sign-in` (with `redirectTo`).                                                                                         |
| `auth.spec.ts`          | Sign up → confirm (emailed link, and the manual 6-digit code path) → dashboard; a signed-in user is bounced away from auth pages.                                                        |
| `critical-path.spec.ts` | Sign up → confirm → schedule a reminder (the reference RLS-backed CRUD flow).                                                                                                            |
| `staff-invite.spec.ts`  | Founder invites a user from `/admin` → invite email → `/accept-invite` (fresh browser context) → set password → `/admin`.                                                                |
| `admin-login.spec.ts`   | Signing in as the admin (founder credentials) routes through `/welcome` into `/admin`, with the Payload UI rendered.                                                                     |

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
