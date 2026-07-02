# STRIPE.md — making Stripe billing work in the Dream Starter Kit

Everything you need to turn on payments. It's written so a **non‑technical founder**
can follow it top to bottom, with a precise reference (exact key permissions, exact
env vars) for engineers further down.

If anything here conflicts with `docs/ARCHITECTURE.md`/`docs/ERD.md`, those win.
Related reading: `CLAUDE.md` → _Payments (Payload ⇄ Stripe)_, `README.md` env table.

---

## 1. How billing works here (read this first — it saves you steps)

The kit is **plan‑driven from the CMS**, not from the Stripe dashboard:

- You **author plans and coupons in Payload** (`/admin` → **Commerce → Plans /
  Coupons**). Saving a plan automatically creates/updates the matching **Product +
  Price** in Stripe. **You never create products or prices in the Stripe dashboard
  by hand.** (Prices are immutable in Stripe, so when you change an amount the kit
  creates a new price and archives the old one for you.)
- A customer pays through a **Stripe Checkout** page (hosted by Stripe — the kit
  redirects to it). Self‑serve changes/cancellations happen in the **Stripe Customer
  Portal**, also hosted by Stripe.
- Stripe tells your app what happened through **two webhooks** (see §4). One mirrors
  products/prices/subscriptions into the database for the apps to read; the other
  mirrors subscriptions into the CMS.

So the whole job is really just three things:

1. Put your **Stripe secret key** into the env (§3).
2. Set up the **two webhooks** and put their signing secrets into the env (§4).
3. **Seed the CMS and save a plan** so it pushes to Stripe (§5).

Everything is **test mode** first (no real money). You flip to live mode at the end.

### What each environment variable is for

| Variable                                       | Secrecy        | What it is                                                                                                                                              | Where it's used                        |
| ---------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `STRIPE_SECRET_KEY`                            | 🔒 server‑only | Your Stripe API key (`sk_test_…` / `rk_test_…` / `sk_live_…`). Lets the kit create products, prices, checkout sessions, etc.                            | Next.js server routes + both webhooks  |
| `STRIPE_WEBHOOK_SECRET`                        | 🔒 server‑only | Signing secret for the **Supabase edge‑function** webhook (mirrors products/prices/subscriptions into `public.*` for the apps).                         | `billing-stripe-webhook` edge function |
| `STRIPE_WEBHOOKS_ENDPOINT_SECRET`              | 🔒 server‑only | Signing secret for the **Payload** webhook (mirrors `customer.subscription.*` into the CMS `subscriptions` collection). A **second, separate** webhook. | `/cms-api/stripe/webhooks`             |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`           | public         | Client‑safe key (`pk_test_…`). **Required for the embedded paywall + two‑step `/checkout`** (Stripe Elements / Express Checkout — Apple/Google Pay + card). Only the hosted redirect‑to‑Checkout flow works without it.                     | client                      |
| `SITE_URL`                                     | server‑only    | Your site origin, used to build the guest‑checkout invite redirect. Defaults to `NEXT_PUBLIC_APP_URL`/localhost.                                        | edge‑function webhook                  |
| `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY` | 🔒             | **Legacy / unused** by the plan‑driven flow. Leave blank.                                                                                               | —                                      |

> The kit fails loudly if a required var is missing. Optional vars must be **absent
> or blank** — never set to `""` in a way the schema rejects (the cloud session hook
> comments them out for you).

---

## 2. Before you start — what you need

- A **Stripe account** (free): <https://dashboard.stripe.com/register>. You can do
  the entire test‑mode setup before you've finished business verification.
- Make sure you are in **Test mode** while setting up: the toggle is the **"Test
  mode"** switch at the top‑right of the Stripe dashboard. Test keys start with
  `sk_test_` / `pk_test_`; live keys start with `sk_live_` / `pk_live_`.
- Know **where your env lives**:
  - **Local dev:** the `.env` file at the repo root (copy from `.env.example`).
  - **Production (Vercel):** Project → **Settings → Environment Variables**.
  - **Supabase edge functions:** set as **Function secrets** (CLI:
    `supabase secrets set …`, or Dashboard → Edge Functions → Secrets).

---

## 3. The Stripe **secret key** — exact permissions + step by step

### 3.1 Which permissions do you need?

You have two options.

**Option A — Standard secret key (simplest).**
Stripe's default secret key (`sk_test_…` / `sk_live_…`) has **full access**. It works
out of the box and is the recommended starting point for most founders. Skip to §3.2.

**Option B — Restricted key (most secure, recommended for production).**
A restricted key (`rk_live_…`) grants only the permissions you choose. The kit uses a
specific, small set of Stripe resources, so you can lock the key down to exactly
these. Set **everything not listed below to _None_**:

| Stripe resource (in the "Create restricted key" screen) | Permission | Why the kit needs it                                        |
| ------------------------------------------------------- | ---------- | ----------------------------------------------------------- |
| **Products**                                            | **Write**  | Create/update a product when you save a plan                |
| **Prices**                                              | **Write**  | Create new prices / archive old ones (prices are immutable) |
| **Coupons**                                             | **Write**  | Create/update/delete intro‑offer & marketing coupons        |
| **Promotion codes**                                     | **Write**  | Create customer‑facing promo codes (e.g. `LAUNCH20`)        |
| **Customers**                                           | **Write**  | Find or create the Stripe customer at checkout              |
| **Checkout Sessions**                                   | **Write**  | Create the hosted checkout page; read its line items        |
| **Customer portal**                                     | **Write**  | Open the self‑serve billing portal (`/billing`)             |
| **Subscriptions**                                       | **Write**  | Create subscriptions (embedded `/express-intent`) + switch plan (1‑click annual `/upgrade-annual`); read in webhooks |
| **PaymentIntents**                                      | **Write**  | Embedded paywall / two‑step checkout card + wallet payments (`/express-intent`) |
| **SetupIntents**                                        | **Write**  | Collect a payment method for trial / $0‑now subscriptions (`/express-intent`) |
| **Charges**                                             | **Read**   | Capture the buyer's wallet identity from the first charge (edge‑function webhook) |
| **Invoices**                                            | **Read**   | List a customer's past invoices on `/billing`               |
| _Everything else_                                       | **None**   | Not used                                                    |

> Signature‑verifying incoming webhooks does **not** require any key permission — it
> only uses the webhook **signing secret** (§4), not the API key.

### 3.2 Generate the secret key (step by step)

1. Go to the Stripe Dashboard and confirm **Test mode** is **on** (top‑right toggle).
2. Open **Developers → API keys** (direct link:
   <https://dashboard.stripe.com/test/apikeys>).
3. **Option A (standard key):** under **Standard keys**, find **Secret key** and
   click **Reveal test key**. Copy the value — it begins with `sk_test_`.
   **Option B (restricted key):** click **Create restricted key**, give it a name
   (e.g. `dream-kit-server`), set the permissions from the table in §3.1 (all others
   **None**), click **Create key**, then **Reveal** and copy it — it begins with
   `rk_test_`.
4. Treat this value like a password. **Never** paste it into client code, commit it,
   or share it. It is server‑only (golden rule #2).

### 3.3 Put it in the env

**Local dev** — edit `.env` at the repo root:

```bash
STRIPE_SECRET_KEY="sk_test_...."   # or rk_test_....
```

Restart `pnpm dev:next` so it picks up the change.

**Production (Vercel)** — Project → **Settings → Environment Variables** → add
`STRIPE_SECRET_KEY` (use your **live** key, `sk_live_…`/`rk_live_…`, when you go
live), scope **Production** (and Preview if you want billing in previews), **Save**,
then **redeploy**.

**Supabase edge function** — the `billing-stripe-webhook` function also needs the
secret key:

```bash
supabase secrets set STRIPE_SECRET_KEY="sk_test_...."
```

### 3.4 Rotating / updating the key later

1. Create the new key (or **Roll** the existing one) in **Developers → API keys**.
2. Update the value in **every** place from §3.3 (local `.env`, Vercel, Supabase
   secrets) and redeploy / restart.
3. Once everything is updated and verified, **revoke** the old key in the dashboard.

---

## 4. The **webhooks** — exact permissions + step by step

Stripe needs to call your app when things happen (a payment succeeds, a subscription
renews or cancels). The kit listens on **two separate endpoints**, each with its
**own signing secret**.

| #   | Endpoint path                                                    | Env var for its secret            | What it does                                                                                                                                                 | Events to send                                                                  |
| --- | ---------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 1   | `…/functions/v1/billing-stripe-webhook` (Supabase edge function) | `STRIPE_WEBHOOK_SECRET`           | Mirrors products, prices, customers & subscriptions into the **`public.*`** tables the web/mobile apps read (RLS). Drives guest‑checkout signup + plan tags. | `product.*`, `price.*`, `checkout.session.completed`, `customer.subscription.*` |
| 2   | `…/cms-api/stripe/webhooks` (Next.js / Payload)                  | `STRIPE_WEBHOOKS_ENDPOINT_SECRET` | Mirrors `customer.subscription.*` into the **CMS `subscriptions`** collection.                                                                               | `customer.subscription.created/updated/deleted`                                 |

**Permissions for webhooks:** there is **no permission/scope to choose** when
creating a webhook — a webhook endpoint just needs the **events** listed above. The
only secret involved is the per‑endpoint **signing secret** (`whsec_…`), which Stripe
gives you when you create the endpoint. (The kit verifies every delivery against it,
so an attacker can't forge events.) Keep both signing secrets **server‑only**.

> ⚠️ Two endpoints = two different `whsec_…` values. Don't reuse one for both vars.

### 4.0 Which kind of webhook? (v1 snapshot events on **your own account**)

Stripe's dashboard now has more than one webhook-style flow. Use the right one:

- **Type:** the kit uses **v1 "snapshot" webhooks** — the classic kind that POST the
  full event object (e.g. `customer.subscription.updated`) to your URL, verified with
  a `whsec_…` signing secret. It does **not** use the newer **v2 / "thin events"**
  (event‑destinations API) shape. If the dashboard asks, an **API version**‑based
  endpoint is what you want, not a "thin payload" one.
- **Scope = "Your account".** When the **Event destination scope** step offers **Your
  account** vs **Connected accounts**, choose **Your account**. The kit is **not** a
  Stripe **Connect** platform (no connected accounts), so the Accounts‑v2‑vs‑v1
  routing described in Stripe's Connect docs does **not** apply.
- **API version — pick a recent one (important).** The kit runs **stripe‑node v22**
  and reads the subscription billing period from the **subscription _item_**
  (`item.current_period_start/​end`), which is how Stripe sends it on **API version
  `2025-03-31` and newer**. If you create the endpoint on an **old** version (the
  dashboard sometimes defaults to something like `2016-07-06`), those period fields
  arrive in the old shape and the CMS mirror records empty periods. So set the
  endpoint's **API version** to your account's **current/default** version (2025+),
  not the legacy default. _(The Supabase edge function tolerates both shapes; the
  Payload mirror expects the new one — so this matters for the CMS `subscriptions`
  endpoint in particular.)_ The **Stripe CLI** (§4.1) already forwards using a recent
  version, so local dev is fine by default.

### 4.1 Local development (using the Stripe CLI — no public URL needed)

Locally, Stripe can't reach your laptop, so you use the **Stripe CLI** to forward
events. It prints a `whsec_…` for each forwarder.

1. **Install the Stripe CLI:** <https://docs.stripe.com/stripe-cli> (macOS:
   `brew install stripe/stripe-cli/stripe`), then `stripe login`.
2. **Forwarder 1 — edge function** (in its own terminal):

   ```bash
   stripe listen --forward-to http://127.0.0.1:54321/functions/v1/billing-stripe-webhook
   ```

   Copy the `whsec_…` it prints into `.env` as:

   ```bash
   STRIPE_WEBHOOK_SECRET="whsec_...."
   ```

3. **Forwarder 2 — Payload** (a second terminal):

   ```bash
   stripe listen --forward-to http://localhost:3000/cms-api/stripe/webhooks
   ```

   Copy that **different** `whsec_…` into `.env` as:

   ```bash
   STRIPE_WEBHOOKS_ENDPOINT_SECRET="whsec_...."
   ```

4. Restart your dev processes so the new secrets load.

> **Cloud sessions:** edge functions don't run in Claude Code cloud sessions (see
> `CLAUDE.md`), so only forwarder 2 (Payload) is testable there. The e2e suite uses
> self‑signed events for the rest.

### 4.2 Production / hosted (Stripe Dashboard) — step by step

Do this once your app is deployed and reachable at a public URL. You create **two**
endpoints, one per row of the table above. (Stripe has renamed "Webhooks" to **Event
destinations** in newer dashboards — the steps are the same; if you still see
**Developers → Webhooks → Add endpoint**, that works too.)

**Open the create flow:**

1. Confirm the **Test mode** toggle (top‑right) is set the way you want — set up in
   **test** first, then repeat in **live** later.
2. Go to **Developers → Webhooks / Event destinations → Add endpoint / Create**
   (<https://dashboard.stripe.com/test/webhooks>).
3. If asked for an **Event destination scope**, choose **Your account** (see §4.0 —
   _not_ Connected accounts).
4. If asked for a **destination type / payload style**, choose the
   **snapshot / Webhook endpoint** option (an **API version**‑based endpoint), _not_
   "thin events".
5. Set the **API version** to your account's **current/default** version (2025+) — not
   the legacy default (§4.0).

**Endpoint #1 — Supabase edge function (`STRIPE_WEBHOOK_SECRET`):**

6. **Endpoint URL:**
   `https://<your-project-ref>.supabase.co/functions/v1/billing-stripe-webhook`
   (find `<your-project-ref>` in Supabase → Project Settings → API).
7. **Select events:** `product.created`, `product.updated`, `price.created`,
   `price.updated`, `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`. (Selecting "all
   events" also works.)
8. Click **Add endpoint / Create**, then on its page click **Reveal** under **Signing
   secret** and copy the `whsec_…`. Set it as a Supabase **function secret**:

   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_...."
   ```

**Endpoint #2 — Payload / CMS (`STRIPE_WEBHOOKS_ENDPOINT_SECRET`):**

9. Repeat steps 2–5 to start a **second** endpoint (same scope, type, and API version).
10. **Endpoint URL:** `https://<your-domain>/cms-api/stripe/webhooks`.
11. **Select events:** `customer.subscription.created`,
    `customer.subscription.updated`, `customer.subscription.deleted`.
12. **Add endpoint / Create**, reveal its **different** `whsec_…`, and set it in
    **Vercel** (Project → Settings → Environment Variables) as
    `STRIPE_WEBHOOKS_ENDPOINT_SECRET`, then **redeploy**.

**Finish wiring:**

13. **Deploy the edge function** (if not already):

    ```bash
    supabase functions deploy billing-stripe-webhook
    ```

14. Make sure `STRIPE_SECRET_KEY` is set in **both** Vercel and Supabase secrets
    (§3.3), and set `SITE_URL` to your site origin in the Supabase secrets so guest
    invite links point at the right place.
15. **Verify:** trigger a test event (Stripe Dashboard → the endpoint → **Send test
    event**, or do a real test‑card purchase per §5) and confirm a **200** under the
    endpoint's **delivery attempts**. A `400 Signature verification failed` means the
    `whsec_…` in that environment doesn't match the endpoint (§6).

### 4.3 Updating / rotating a webhook secret

If you delete and recreate an endpoint, or click **Roll secret** on it, copy the new
`whsec_…` into the matching env var (table in §4) **in the right place** (Supabase
secret for #1, Vercel for #2) and redeploy/restart.

---

## 5. Make it functional — the full checklist

Do these in order. Test mode throughout.

1. **Set `STRIPE_SECRET_KEY`** everywhere it's needed (§3.3).
2. **Set up both webhooks** and their secrets (§4) — CLI forwarders locally, dashboard
   endpoints in production.
3. **Run the app**, sign up (the **first** signup becomes the founder/admin), and let
   it route you through `/cms-setup`, which **seeds the CMS** (creates the default
   **Dream Monthly / Annual / Lifetime** plans + a welcome coupon).
4. **Push the plans to Stripe:** open `/admin` → **Commerce → Plans**, open a plan and
   click **Save**. The `afterChange` hook creates the Stripe product + price. (Seeded
   plans stay `unsynced` until first saved — this is the step that syncs them.) Check
   the plan's **Sync status** field shows success; if it errored, the message is in
   **Sync error**.
5. **Confirm the mirror:** saving + the webhooks should populate the products/prices
   in the DB. The public **`/pricing`** page should now show your plans.
6. **Do a test purchase:** go to `/pricing`, start checkout, and pay with Stripe's
   **test card `4242 4242 4242 4242`**, any future expiry, any CVC, any ZIP. After
   payment you should land back in the app with premium unlocked, and a **subscription**
   row should appear in `/admin → Commerce → Subscriptions`.
7. **Test self‑serve billing:** visit **`/billing`** — you should see the current plan,
   a link to the Stripe **Customer Portal** (change/cancel), and past invoices.

### Going live

1. Finish Stripe **business/account verification** so live mode is enabled.
2. Switch the dashboard to **Live mode** and repeat §3 (live `sk_live_…`/`rk_live_…`)
   and §4 (live webhook endpoints → new `whsec_…`) for production.
3. Update Vercel + Supabase secrets with the **live** values and redeploy.
4. Re‑save each plan in `/admin` so it syncs to your **live** Stripe account.

---

## 6. Troubleshooting

- **`Billing not configured` (503) at checkout** → `STRIPE_SECRET_KEY` is missing in
  that environment. Re‑check §3.3 (it must be set for the Next.js server, not just the
  edge function) and redeploy/restart.
- **Plan saves but Sync status shows an error** → the secret key lacks a needed write
  permission (see the §3.1 table) or you're in the wrong mode (test vs live). The
  message is in the plan's **Sync error** field.
- **Paid in test mode but nothing unlocked / no subscription row** → the webhook isn't
  reaching you or the signing secret is wrong. Check the endpoint's **delivery
  attempts** in the Stripe Dashboard (or the CLI terminal). A `400 Signature
verification failed` means `STRIPE_WEBHOOK_SECRET` / `STRIPE_WEBHOOKS_ENDPOINT_SECRET`
  doesn't match that endpoint — copy the right `whsec_…` (remember: two endpoints, two
  secrets) and redeploy.
- **Subscriptions show in the apps but not in the CMS (or vice‑versa)** → you've only
  configured one of the two webhooks. Both endpoints in §4 are required for full
  coverage.
- **CMS subscription row has empty "current period" dates** → the webhook endpoint was
  created on an **old API version**. The CMS mirror reads the period from the
  subscription item (API 2025+). Edit the endpoint's **API version** to your account's
  current version (§4.0) and re‑send / re‑trigger the event.
- **Guest‑checkout invite emails point at the wrong site** → set `SITE_URL` in the
  Supabase function secrets to your production origin.
- **Never** put the secret key or a signing secret in `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*`
  vars or client code — those compile into the browser/app bundle (golden rules #2/#3).
