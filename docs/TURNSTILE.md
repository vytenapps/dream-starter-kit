# Cloudflare Turnstile (CAPTCHA / bot protection)

The kit protects its Supabase auth endpoints — **anonymous sign-in**, sign-in,
sign-up, OTP, and password reset — with [Cloudflare Turnstile](https://www.cloudflare.com/application-services/products/turnstile/),
a free, privacy-friendly CAPTCHA. We use Supabase's **built-in** CAPTCHA support
(Supabase verifies the token server-side — there is **no** custom edge function),
following Supabase's [Enable CAPTCHA Protection](https://supabase.com/docs/guides/auth/auth-captcha)
guide. When enabled, the client renders an **invisible** widget and passes the
resulting token to `supabase.auth.*` as `options.captchaToken`. CAPTCHA is **off by
default** (no widget in the bundle); section 3 shows how to turn it on.

> Why it matters here: enabling anonymous sign-ins (`enable_anonymous_sign_ins`)
> lets a visitor get a real `auth.uid()` on their first action (favoriting any content).
> Without a CAPTCHA, that endpoint is an open door for bots to mint accounts. Turnstile
> closes it. **Enabling CAPTCHA is global** — once on, *every* auth call must send a
> token, so the sign-in/sign-up forms send one too.

---

## 1. Create the Turnstile widget (Cloudflare dashboard)

1. Sign in to the [Cloudflare dashboard](https://dash.cloudflare.com) → **Turnstile**
   (left nav) → **Add widget**.
2. **Widget name:** e.g. `meet-dream`.
3. **Hostnames:** add every domain the app runs on:
   - your production domain (e.g. `meetdream.com`)
   - any preview domains you use (e.g. `*.vercel.app` — or add specific preview hosts)
   - `localhost` **and** `127.0.0.1` for local development
4. **Widget Mode:** choose **Invisible** (no checkbox unless Cloudflare flags the
   session). ("Managed" also works if you prefer a visible challenge.)
5. Click **Create**. Cloudflare shows two values — copy both:
   - **Site Key** (public, starts with `0x...`) → goes in our app env.
   - **Secret Key** (private) → goes in **Supabase** (never in our app/client).

> Cloudflare reference: [Create a widget](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/).

---

## 2. Add the keys to the right places

The **Site Key is public** (compiled into the browser bundle). The **Secret Key
belongs to Supabase**, which performs the server-side `siteverify` — our Next.js
app never sees it.

### a) Site Key → our env (public)

Add to `.env` (local) and your host (e.g. Vercel project env), and it's already
declared in the zod schemas:

```bash
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0xAAAAAAAAAAAAAAAAAAAAAA
```

- Declared in `apps/nextjs/src/env.ts` (`client` block + `experimental__runtimeEnv`)
  and `packages/config/src/env.ts` (`clientEnvSchema`), both **optional** — if unset,
  the app skips the widget (use only with CAPTCHA disabled in Supabase).
- Also listed in `.env.example`.

### b) Secret Key → Supabase

**Hosted Supabase:** Dashboard → **Authentication** → **Bot and Abuse Protection**
→ enable **Enable CAPTCHA protection**, choose provider **Turnstile**, paste the
**Secret Key**, **Save**. (Equivalent dashboard path:
`https://supabase.com/dashboard/project/_/auth/protection`.)

**Local development** (`supabase/config.toml`) — the secret is read from an env var
so it stays out of git:

```toml
[auth.captcha]
enabled = true
provider = "turnstile"
secret_key = "env(TURNSTILE_SECRET_KEY)"
```

and in your local `.env`:

```bash
# Supabase reads this (NOT compiled into our client bundle)
TURNSTILE_SECRET_KEY=0x1111111111111111111111111111111111
```

> `enable_anonymous_sign_ins = true` must also be set under `[auth]` in
> `config.toml` for the anonymous-account flow.

---

## 3. Client usage (how the token is sent)

The auth helpers in `packages/app/src/auth.ts` already accept a token and pass it
through to Supabase as `options.captchaToken`:

- `ensureAnonSession(client, { captchaToken })` → `signInAnonymously({ options: { captchaToken } })`
- the same `captchaToken` belongs on `signInWithPassword` / `signUp` /
  `signInWithOtp` / `resetPasswordForEmail` (CAPTCHA is global once enabled).

The token is **optional**: when CAPTCHA is disabled (the default — and in local/CI),
callers pass `undefined` and everything works tokenless. **There is no CAPTCHA widget
in the bundle by default** (no `@marsidev/react-turnstile` dependency), so enabling
CAPTCHA is a deliberate, two-part step:

1. Enable it in Supabase (section 2b) and set the site key (section 2a).
2. Add the frontend widget and feed its token to the auth helper. Per the Supabase
   [auth-captcha guide](https://supabase.com/docs/guides/auth/auth-captcha), install
   the React component and capture the token:

   ```bash
   pnpm -F @acme/nextjs add @marsidev/react-turnstile
   ```

   ```tsx
   import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
   import { ensureAnonSession } from "@acme/app";

   const [captchaToken, setCaptchaToken] = useState<string>();
   const captcha = useRef<TurnstileInstance>(null);

   <Turnstile
     siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
     options={{ size: "invisible" }}
     onSuccess={setCaptchaToken}
     ref={captcha}
   />;

   // before the first per-user write (e.g. favoriting any content):
   await ensureAnonSession(supabase, { captchaToken });
   captcha.current?.reset(); // tokens are single-use
   ```

   For "invisible unless a human challenge is needed", use `appearance: "interaction-only"`.

---

## 4. Local / CI testing (always-pass keys)

Turnstile publishes [test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
that never challenge — use them locally and in CI so Playwright / RLS tests and cloud
sessions aren't blocked:

| Purpose | Site key | Secret key |
| --- | --- | --- |
| **Always passes** (use for dev/CI) | `1x00000000000000000000AA` | `1x0000000000000000000000000000000AA` |
| Always blocks (test the failure path) | `2x00000000000000000000AB` | `2x0000000000000000000000000000000AA` |
| Forces an interactive challenge | `3x00000000000000000000FF` | (n/a) |

So a typical local `.env`:

```bash
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

> Use the **real** keys only on hosted/production. The cloud-session SessionStart
> hook leaves unset optional vars commented out (empty strings fail the zod
> `min(1)` checks), so CAPTCHA stays effectively off in cloud sessions unless you
> add the test keys.

---

## 5. Verify

1. With CAPTCHA enabled in Supabase but **no** token sent, an auth call should fail
   with a `captcha` error → confirms enforcement is on.
2. With the widget mounted (real or test site key), the same call succeeds.
3. Favorite any content as a logged-out visitor → an anonymous `auth.users` row is
   created (the `signInAnonymously` call carried a valid token).
