# Authentication settings (System → Authentication)

The **Authentication** settings screen (Payload admin → **System → Authentication**)
lets staff choose which sign-in methods the app offers, in what order, plus
sign-up access rules, password strength, copy, and SAML SSO routing — without
touching code. It is a standard staff-editable Payload global
(`authentication-settings`), read at request time by the web auth pages and the
Expo app.

## The mental model: this is a presentation layer

**Supabase's GoTrue server (its `config.toml` / hosted dashboard) is the source
of truth for what auth actually works** — which OAuth providers exist, whether
sign-up is open, whether captcha is enforced, whether SAML is enabled. Our
Next.js app **cannot change those at request time**.

So this screen controls the **UI + client logic**: which methods/forms render,
which is the primary call-to-action, the order they appear, client-side
validation, and copy. Each method that depends on a matching Supabase setting
carries an inline note linking back to this doc. We do **not** call the Supabase
Management API.

Practically: enabling "Google" here shows the Google button, but Google must
*also* be enabled in Supabase with a client id/secret or the button errors.

## Where it's read

- **Web** (`apps/nextjs`): the sign-in / sign-up / forgot-password RSC pages call
  `getAuthSettings()` (`src/lib/payload.ts`) and pass the normalized settings to
  the shared `AuthFlow` client component (`src/components/auth/auth-flow.tsx`).
  Reads are cached per request and degrade to safe defaults when the CMS is
  unreachable, so the auth screens always render.
- **Mobile** (`apps/expo`): the screens use the `useAuthConfig()` hook
  (`@acme/app`), which fetches the public **`GET /api/auth/config`** endpoint
  (the CMS REST bridge is staff-only today). The endpoint returns the same
  normalized config (no secrets).
- The cross-platform shape, defaults, and helpers live in
  `packages/app/src/auth-settings.ts` (`AuthSettings`, `normalizeAuthSettings`,
  `chooserEntries`, `isEmailDomainAllowed`, `ssoParamsForEmail`).

## Methods: reorder + toggle

The **Methods** tab is an orderable list. **Drag to reorder, toggle to
enable/disable.** The **first enabled method is the primary** (filled) button;
the rest stack below it. The login UI follows the shadcn **login-05** pattern: a
centered card with "Continue with …" buttons.

The three email methods collapse into a single **"Continue with email"** button
(positioned at the first enabled email method), which opens a short
email → password / check-your-email sub-flow:

| Method | UI | Supabase mechanism | Prerequisite |
| --- | --- | --- | --- |
| **Email + password** | password field after the email step | `signInWithPassword` / `signUp` | none |
| **Magic link** | "Email me a link" → check email | `signInWithOtp` (link) | none |
| **Email code (OTP)** | "Email me a code" → enter code | `signInWithOtp` + `verifyOtp` | none |
| **Google** | "Continue with Google" | `signInWithOAuth` | see [#google](#google) |
| **Apple** | "Continue with Apple" | `signInWithOAuth` | see [#apple](#apple) |
| **SAML 2.0 SSO** | "Continue with SAML SSO" | `signInWithSSO` | see [#sso](#sso) |

## Sign-up & access tab

- **Allow sign-ups** — off = invite-only (see [#invite-only](#invite-only)).
- **Email domain mode** + **domains** — allow/block sign-ups by email domain
  (checked client-side and should be re-checked in any server route that creates
  accounts).
- **Terms / Privacy URLs** + **Require terms acceptance** — the footer links and
  an optional "I agree" checkbox shown before sign-up.
- **Post-login / post-signup redirect** — override the default `/welcome`
  role-based routing.

## Security tab

<a id="passwords"></a>

- **Minimum password length** — drives the client-side password rule. It must be
  **≥ Supabase's server-side `minimum_password_length`** (in `config.toml`) to be
  enforced end-to-end; the app can only make the UI rule *stricter*, not the
  server.

<a id="captcha"></a>

- **Require Cloudflare Turnstile** — surfaces intent to require a Turnstile token
  on auth actions. Full enforcement also needs the Turnstile **site key** set
  (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`) and Supabase's `[auth.captcha]` enabled. See
  `docs/TURNSTILE.md`.

## Appearance tab

Optional **sign-in heading**, **sign-up heading**, and **subtitle**. Blank uses
the kit defaults ("Welcome to Acme Inc", "Create your workspace"). The brand icon
is the fixed `GalleryVerticalEnd` mark.

## SSO tab

<a id="sso"></a>

SAML 2.0 SSO routes by email domain. Map a domain to a registered Supabase SSO
provider (or leave the provider id blank to let Supabase resolve it from the
domain). **This screen only surfaces the entry point** — SAML must be enabled in
Supabase and the identity provider registered:

```toml
# supabase/config.toml
[auth.sso]
enabled = true
```

```bash
# register an identity provider (per domain)
supabase sso add --type saml --metadata-url <IdP metadata> --domains acme.com
```

## Supabase prerequisites by method

<a id="google"></a>

### Google

```toml
# supabase/config.toml
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
skip_nonce_check = true   # required for local sign-in
```

Set `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET` (and the same in the
hosted dashboard for production).

<a id="apple"></a>

### Apple

```toml
[auth.external.apple]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_APPLE_SECRET)"
```

<a id="invite-only"></a>

### Invite-only sign-up

Turning **Allow sign-ups** off hides the public sign-up UI and shows an
invite-only notice. For **hard** server enforcement also set:

```toml
[auth]
enable_signup = false
```

New staff are still invited from `/admin → Users → Create New`.

## Schema / migration

The global lives in the `cms` schema. After changing the global config,
regenerate types and the migration on a machine with a running database:

```bash
pnpm cms:gen-types        # regenerates packages/cms/src/payload-types.ts
pnpm cms:migrate:create   # generates the cms migration — commit it
```

In dev/CI the table is created by Payload's dev "push"; production runs committed
migrations on first boot (`prodMigrations`). See `CLAUDE.md` → "How to add a
Payload content type".

## What stays in Supabase (not configurable here)

Session/JWT expiry, refresh-token rotation, server-side password requirements,
OTP length/expiry, rate limits, and MFA live in `supabase/config.toml` (or the
hosted dashboard) and are **not** controllable from this screen.
