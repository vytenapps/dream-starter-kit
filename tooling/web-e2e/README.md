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
before `/admin`; every later signup lands on the app home (`/a`, the dashboard). The `setup` project
(`founder.setup.ts`) provisions that founder first (and saves their session for
`staff-invite.spec.ts`), so the parallel specs that assert "sign-up → dashboard"
run as non-staff users. Each spec uses a unique email so repeated runs against
the same DB don't collide. The staff-invite spec also needs
`SUPABASE_SERVICE_ROLE_KEY` in `.env` (the invite hook uses it).

## What's covered

| Spec                    | Flow                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `founder.setup.ts`      | Setup project (runs first): the runtime DB bootstrap health gate (`/api/health/db` must not report `error`; in CI it must be `ok` — see the TLS section below), then founder sign-up → confirm via Mailpit link → `/cms-setup` seeds the CMS → `/admin`. Provisions the founder + seeded content the rest of the suite relies on.                                                                                  |
| `smoke.spec.ts`         | Landing renders; a protected route redirects signed-out users to `/sign-in` (with `redirectTo`).                                                                                                                                                                                                                                                                                                                   |
| `auth.spec.ts`          | Sign up → confirm (emailed link, and the manual 6-digit code path) → dashboard; unconfirmed sign-in re-sends the confirmation; a signed-in user is bounced away from auth pages.                                                                                                                                                                                                                                   |
| `critical-path.spec.ts` | Sign up → confirm → schedule a reminder (the reference RLS-backed CRUD flow).                                                                                                                                                                                                                                                                                                                                      |
| `staff-invite.spec.ts`  | Founder invites a user from `/admin` → invite email → `/accept-invite` (fresh browser context) → set password → `/admin`.                                                                                                                                                                                                                                                                                          |
| `admin-login.spec.ts`   | Signing in as the admin (founder credentials) routes through `/welcome` into `/admin`, with the Payload UI rendered.                                                                                                                                                                                                                                                                                               |
| `subscription.spec.ts`  | The Payload Stripe webhook mirror (self-signed `customer.subscription.*` events → the read-only CMS `subscriptions` collection; bad signatures rejected), its access control (anonymous denied, staff read-only, REST proxy off), and — when a test-mode `STRIPE_SECRET_KEY` is set — real Stripe Checkout subscription creation as an authenticated user and as a guest with the `4242 4242 4242 4242` test card. |

## Reproducing hosted-Supabase TLS locally (optional)

Hosted Supabase serves Postgres over TLS with a cert chain rooted in
Supabase's **own CA** — no client trust store verifies it. CI mirrors that
(`.github/workflows/ci.yml`): it enables TLS on the local DB container with a
throwaway self-signed cert and appends `sslmode=require` to `SUPABASE_DB_URL`
and `PAYLOAD_DATABASE_URL`, so `next dev`'s runtime DB bootstrap and Payload's
pool exercise the exact hosted connection path; `founder.setup.ts` then fails
the suite if `/api/health/db` doesn't report `ok`. To reproduce locally:

```bash
supabase start
bash tooling/scripts/enable-supabase-db-tls.sh   # idempotent; --disable reverts
# in .env: append ?sslmode=require to SUPABASE_DB_URL
#          and    &sslmode=require to PAYLOAD_DATABASE_URL
pnpm test:e2e
```

This is **not required** for normal local runs — without `sslmode` in `.env`
the bootstrap connects plaintext and the suite stays green. Plaintext clients
keep working with TLS enabled (`ssl=on` doesn't force SSL). The cert + config
live together in the DB docker volume (so a half-applied state can't brick a
boot), but the supabase entrypoint resets `postgresql.auto.conf` on container
recreation — just re-run the (idempotent) script after
`supabase stop && supabase start`.

CI also leaves `PAYLOAD_SECRET` / `PAYLOAD_DATABASE_URL` **unset**: the e2e
run exercises the zero-touch path a clone-and-connect deploy takes — both are
derived from `SUPABASE_SERVICE_ROLE_KEY` and the runtime bootstrap creates the
`payload_cms` role with the derived password on the app's first boot. Locally
keep them set (the `db reset` path provisions the role with the dev password,
which wouldn't match a derived one).

## Deliberately not covered here

- **Stripe → `public.*` webhook delivery** — the edge-function side of the
  pipeline needs `stripe listen` forwarding to the local function. The Payload
  webhook mirror IS covered (see `subscription.spec.ts`, which signs its own
  events); the Checkout flows there also stay skipped until you provide
  test-mode keys.
- **AI chat round-trip** — sending a message needs a real `AI_GATEWAY_API_KEY`
  (not present in CI). Thread/message persistence + isolation are covered by the
  RLS regression (`pnpm test:rls`); add a `chat.spec.ts` with a mocked or
  test-keyed model when you want full coverage.

These are intentional extension points, not bugs — the security-critical paths
(auth, route protection, RLS isolation, CRUD) all run in CI on every PR.
