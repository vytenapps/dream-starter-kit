# Meet Dream Starter Kit — Architecture

> A clone-and-ship starter for building any web + mobile app idea from the Meet Dream catalog.
> One monorepo → a **Next.js web app** plus **Expo (iOS + Android) apps** that share a backend,
> optimized so a founder can extend it with Claude Code.
>
> **License:** MIT — see [§8 Licenses & MIT compatibility](#8-licenses--mit-compatibility).
> **Data model:** see [`ERD.md`](./ERD.md).
> **Status:** source-of-truth architecture for the starter repo.

---

## 1. Design goals

- **Universal.** One codebase ships web, iOS, and Android. Shared business logic and data layer; platform-appropriate UI.
- **Few signups.** Lean on services that each replace several (Supabase is the backbone; AI runs through Vercel).
- **AI-coding-friendly.** Tailwind + shadcn conventions and a clear structure so Claude Code (and v0/Cursor) can extend the kit reliably.
- **Permissively licensed end to end** so the starter itself can ship as MIT.

---

## 2. Stack at a glance

| Layer | Choice |
|---|---|
| Monorepo / base | **Fork of `create-t3-turbo`** (Turborepo) |
| Web app | Next.js (App Router) |
| Mobile app | Expo + Expo Router (iOS + Android) |
| Styling | Tailwind CSS (web) + NativeWind (native) |
| Components — web | shadcn/ui |
| Components — native | react-native-reusables ("shadcn for React Native") |
| Glass aesthetic (optional) | `liquid-glass-react` (rdev) — single web hero effect |
| Database | Supabase (Postgres) |
| Auth | **Supabase Auth + Row-Level Security (RLS)** |
| File storage | Supabase Storage |
| Payments / subscriptions | Stripe (web subscriptions) |
| AI features | Vercel AI SDK (v6) + AI Elements, via the **Vercel AI Gateway** (Claude as default model) |
| In-app chat UI | Patterns from the Vercel **Chatbot** template |
| Multi-platform bot (optional) | Vercel **Chat SDK** (Slack / Teams / Discord / etc.) |
| Mobile build & submit | Expo EAS (Build + Submit) |
| Push notifications | Expo Push |
| Web hosting | Vercel |

---

## 3. Repository structure

```
meet-dream-starter/
├─ apps/
│  ├─ next/                 # Next.js web app (App Router) — shadcn + Tailwind
│  └─ expo/                 # Expo app → iOS + Android (Expo Router) — react-native-reusables + NativeWind
├─ packages/
│  ├─ app/                  # shared features, screens, hooks (most of the code)
│  ├─ ui/                   # shared design tokens / cross-platform primitives
│  ├─ api/                  # Supabase client + generated types + data hooks
│  └─ config/               # tsconfig, eslint, env schema (zod), constants
├─ supabase/
│  ├─ migrations/           # SQL schema + RLS policies (implements ERD.md)
│  ├─ functions/            # edge functions (Stripe webhook, AI proxy, etc.)
│  └─ seed.sql              # demo data
├─ .github/workflows/       # CI: typecheck, lint, test
├─ ERD.md                   # base data model (entities + RLS pattern)
├─ eas.json                 # mobile build profiles (dev / preview / prod)
├─ turbo.json               # Turborepo pipeline
├─ CLAUDE.md                # architecture + "how to add a feature" for AI agents
├─ NOTICE                   # upstream attributions (see §8)
└─ README.md
```

The rule that keeps it maintainable: anything cross-platform lives in `packages/`; the two `apps/` are thin entry points.

---

## 4. Layers

### 4.1 Monorepo & base — fork `create-t3-turbo`

Start from `create-t3-turbo` rather than `vercel/platforms` (a multi-tenant **subdomain** demo, web-only) or bare `create-turbo` (just two Next.js apps — no Expo, routing, or UI wiring). `create-t3-turbo` already provides the expensive universal plumbing: the Expo + Next.js apps, Expo Router, NativeWind, shadcn on web, shared packages, and CI. Replace its backend layer with Supabase-native (§4.5).

### 4.2 Web app — Next.js (App Router)

The marketing site, idea/landing pages (SEO-critical for the Meet Dream funnel), the paywall, account, and the web AI surface.

### 4.3 Mobile app — Expo + Expo Router

The iOS and Android app. File-based routing mirrors the web. Built and shipped via EAS (§4.9).

### 4.4 UI — shadcn (web) + react-native-reusables (native)

- **Web:** shadcn/ui (Radix + Tailwind), copy-paste-and-own.
- **Native:** react-native-reusables — the same shadcn philosophy on React Native via NativeWind, so web and native UIs stay visually consistent without being identical files.
- **Shared styling language:** Tailwind tokens (web) ↔ NativeWind (native).

**Optional glass aesthetic.** A single web hero effect only:
- True Apple refraction for one hero element: **`liquid-glass-react`** (rdev) — an npm dependency. Note it renders the displacement only in Chromium; Safari/Firefox fall back to a plainer look.
- This is **web-only**. On native, get the glass look via `expo-blur` (BlurView) + NativeWind (recent Expo SDKs are also adding native iOS-26 "Liquid Glass" support).
- Use glass as an **accent** on landing/paywall, not everywhere — backdrop-blur is expensive to paint and can hurt contrast on a conversion-critical funnel.

### 4.5 Backend — Supabase (DB + Auth + Storage)

One Supabase project provides Postgres, **Supabase Auth**, and Storage (plus realtime, edge functions, and pgvector if needed).

**Authorization is enforced at the database with Row-Level Security (RLS).** Every table carries an owner (`user_id`, or reachable via an org membership), and policies restrict rows to `auth.uid()`. This is secure-by-default: a bug in app code can't return another user's rows — which matters for a template handed to many less-experienced founders. The data model and the canonical RLS pattern live in [`ERD.md`](./ERD.md).

> Migration note: `create-t3-turbo` ships Better Auth + tRPC/Drizzle. Going Supabase-native means **replacing that auth + data layer** with the Supabase client + RLS. It's contained surgery — you keep the monorepo, Expo, routing, and UI from the fork, and swap the backend.

### 4.6 Payments / subscriptions — Stripe (web)

Subscriptions are sold on the **web** with Stripe: Checkout + customer portal + a webhook handler (a Supabase edge function) that syncs billing state into the database (the billing tables in `ERD.md`). The two-state consent drawer is a web flow.

The mobile apps stay **free-to-download** and unlock premium from the account's Stripe subscription — so **no in-app-purchase tooling is required**. Selling digital subscriptions *inside* the iOS/Android apps is **out of scope** for this starter: Apple and Google require their own billing for in-app digital goods, so a cloner who needs that would add native billing (StoreKit / Play Billing) themselves.

### 4.7 AI features — Vercel AI SDK (v6) via the AI Gateway

Build AI features with the `ai` package (`streamText`, `useChat`, tool calling, structured output) and route every model call through the **Vercel AI Gateway** — a single endpoint (`https://ai-gateway.vercel.sh`) that fronts 40+ providers, so you never manage per-provider keys.

- **One credential.** Use an `AI_GATEWAY_API_KEY`, or — when deployed on Vercel — OIDC tokens are injected automatically, so there's no key to manage. This folds the LLM under your Vercel account: **no separate Anthropic signup.**
- **Default model: Claude.** Pass a `provider/model` string, e.g. `anthropic/claude-opus-4.x` or `anthropic/claude-sonnet-4.x`. Switching model or provider later is a one-string change.
- **Pass-through pricing** at provider API rates (no Gateway markup), with provider routing, automatic failover, and spend/observability built in.
- Keep the call server-side (a Next.js route or a Supabase edge function). Model slugs change often — resolve them via `gateway.getAvailableModels()` or the docs rather than hardcoding.
- Pair with **AI Elements** for prebuilt chat UI. Chat history persists in the `chat_threads` / `chat_messages` tables (see `ERD.md`).

### 4.8 Chat surfaces — Chatbot template + Chat SDK

Two distinct Vercel things (often confused — they were both once called "Chat SDK"):

- **Chatbot template** (`vercel/chatbot`, formerly "AI Chatbot"/"Chat SDK"): a full Next.js chat application (message persistence, auth, multimodal, artifacts, generative UI) built on the AI SDK. Use it as a **reference/pattern source** for your in-app assistant UI — it's a web app, so lift patterns into your shared components rather than adopting it wholesale.
- **Chat SDK** (`vercel/chat`, `npm i chat`): a different library — a unified framework for building **bots that run inside Slack, Microsoft Teams, Google Chat, Discord, GitHub, Linear**, etc. from one codebase. **Optional** — include it only if you want the Meet Dream coach (or a cloner's app) to live in those external chat platforms. Its `post()` accepts an AI SDK stream, so it composes with §4.7. Not needed for an in-app assistant.

### 4.9 Build & ship

- **Mobile:** Expo **EAS Build** (cloud builds, no local native toolchain required) + **EAS Submit** (store submission). Dev builds / Expo Go for testing.
- **Push:** **Expo Push** (free). Note: remote push no longer works in Expo Go on Android (SDK 53+), so test it in a **dev build**.
- **Web:** Vercel (preview deploys, edge, SEO).

---

## 5. Key decisions (recap)

| Decision | Choice | Rejected alternatives |
|---|---|---|
| Base repo | Fork `create-t3-turbo` | `vercel/platforms` (multi-tenant, web-only); bare `create-turbo` (no mobile/UI plumbing) |
| Auth | **Supabase Auth + RLS** | Better Auth (the base's default — replaced) |
| UI sharing | shadcn + react-native-reusables | Tamagui (write-once, but steeper curve + less AI-tool fluency) |
| Subscriptions | Web-first Stripe | in-app billing / RevenueCat (out of scope) |
| AI provider | **Vercel AI Gateway** (Claude default) | a direct Anthropic API key |
| In-app chat | AI SDK + Chatbot-template patterns | new Chat SDK (that's for external platforms) |

---

## 6. External services (signups)

| Service | Used for | Free to start | Required? |
|---|---|---|---|
| Supabase | DB, Auth, Storage (+ realtime, functions, vectors) | Yes | Yes |
| Vercel | Web hosting, previews, **AI Gateway** | Yes (Hobby) | Yes |
| Expo (EAS) | iOS/Android builds, submit, push | Yes | Yes |
| Stripe | Web subscriptions/payments | Yes (per-txn) | Yes (for monetization) |

Core path is **four signups** (Supabase, Vercel, Expo, Stripe) + GitHub. AI runs through the **Vercel AI Gateway** under your Vercel account — usage billed pass-through at provider API rates — so there's no separate AI-provider signup.

---

## 7. In-app purchase summary

No in-app-purchase tooling is included. Sell subscriptions on the **web** with Stripe and unlock premium in the apps from the account's subscription. Selling digital subscriptions inside the mobile apps is **out of scope** — Apple and Google require their own billing for in-app digital goods. Add native billing (StoreKit / Play Billing) yourself only if a specific app needs it.

---

## 8. Licenses & MIT compatibility

**Can the starter be MIT?** **Yes** — but note that **not every dependency is MIT**: the Vercel libraries are **Apache-2.0**. Both MIT and Apache-2.0 are permissive and fully compatible with shipping an MIT repo. *(This section is engineering guidance, not legal advice; for anything load-bearing, have counsel review.)*

| Component | Role | License | How it's used |
|---|---|---|---|
| create-t3-turbo | Base monorepo | **MIT** | Forked — retain its copyright + license |
| Turborepo | Build system | MIT | Dependency |
| Next.js | Web framework | MIT | Dependency |
| Expo / EAS | Mobile framework + builds | MIT | Dependency |
| React Native | Mobile runtime | MIT | Dependency |
| Tailwind CSS | Styling (web) | MIT | Dependency |
| NativeWind | Styling (native) | MIT | Dependency |
| shadcn/ui | Web components | MIT | Copied in (registry) |
| react-native-reusables | Native components | MIT | Copied in (registry) |
| `liquid-glass-react` (rdev) | Apple liquid-glass effect (web) | **MIT** (verified) | Dependency; Chromium-only, optional |
| supabase-js | Backend client (DB/Auth/Storage) | MIT | Dependency *(the hosted Supabase platform itself is Apache-2.0; not redistributed by you)* |
| Stripe SDKs | Payments | MIT | Dependency |
| **Vercel AI SDK (`ai`)** | AI library | **Apache-2.0** (verified) | Dependency |
| **Vercel Chatbot template (`vercel/chatbot`)** | In-app chat reference | **Apache-2.0** *(LICENSE wording; verify)* | Reference / copy-in |
| **Vercel Chat SDK (`vercel/chat`)** | Multi-platform bot framework | **Apache-2.0** *(verify LICENSE)* | Dependency, optional |

*(The Vercel AI Gateway is a hosted service you call over HTTP, not redistributed code, so it carries no license obligation for your repo — same as the Supabase platform.)*

### How to keep the repo MIT (mechanics)

1. **Your own code → MIT.** Add a `LICENSE` with your copyright.
2. **npm dependencies impose nothing on your license.** Whether a dependency is MIT, Apache-2.0, or BSD, installing it via `package.json` doesn't force your code to adopt that license. The Apache-2.0 ones (AI SDK, Chat SDK) are fine — Apache-2.0 → MIT-licensed project is a supported, common combination.
3. **Forked code (`create-t3-turbo`, MIT).** MIT lets you relicense/redistribute, but you must **retain the original copyright notice + MIT text** for the portions that came from it. Keep them in `NOTICE` or alongside your `LICENSE`.
4. **Copied-in registry components (shadcn, react-native-reusables — both MIT).** They become your source; keep any attribution headers the upstream included.
5. **If you copy Apache-2.0 _source_ into the repo** (e.g., lifting code out of the Chatbot template rather than just reading it): that copied code stays Apache-2.0 — preserve its license header, keep the `NOTICE` file, and state significant changes. Your repo can still be **MIT overall** (mixed-license repos are normal; note the exception). If you only use it as a reference and write your own implementation, nothing attaches.
6. **Add a `NOTICE` / "Acknowledgements" section** listing upstream projects and their licenses (the table above is a starting point).
7. **Verify the real tree** before publishing: run a license checker (e.g., `license-checker` / `licensee`) over the installed dependencies to catch anything copyleft (GPL/AGPL) that would conflict. Nothing in this stack is copyleft, but a transitive dependency could surprise you.

**Bottom line:** ship your starter under MIT, keep upstream MIT/Apache-2.0 attributions, and add a `NOTICE`. The Apache-2.0 dependencies don't block it.

---

## 9. Dependency updates & upstream patching

Long-term maintainability depends on knowing **which dependencies can be patched automatically and which can't**. The kit mixes three update channels — treating them the same is how a cloned app rots.

### 9.1 Three update channels

1. **Versioned npm packages — patchable, automatable.** The Vercel **AI SDK** (`ai`, `@ai-sdk/*`), **Chat SDK** (`chat`, optional), **Stripe** SDKs, **`@supabase/supabase-js`**, **Next.js**, the **Expo SDK** + `expo-*` modules, **React / React Native**, **NativeWind**, **Tailwind**, and `liquid-glass-react`. These are pinned in `package.json` / the pnpm **catalog** and bumped with `pnpm update` (or `expo install --fix`). This is the bulk of the tree and it is fully patchable.
2. **Copy-in "registry" source — you own it, semi-manual.** **shadcn/ui** and **react-native-reusables**. The registry CLI copies source *into* your repo; by design there is no version to bump. "Patching" means re-running the registry add for a component (`pnpm ui-add <component>`), diffing against your local edits, and re-applying. Record which registry/style you used so re-adds stay consistent.
3. **One-time scaffold — not tracked.** **`create-t3-turbo`** itself and the **Chatbot template** patterns. These are forked/lifted snapshots, not live dependencies (see §9.3).

### 9.2 Single source of truth for versions

Keep every version in the pnpm **catalog** (`pnpm-workspace.yaml`) so web and native never drift and a bump is one line. Add **Renovate** (or Dependabot) to open grouped PRs against the catalog. **Exception:** let Expo own its native-compatible versions — bump `expo` + `expo-*` + `react-native` via `expo install --fix` and the SDK upgrade guide, not via Renovate, so native modules stay on versions Expo has validated.

### 9.3 Recommendation — should you patch/track `create-t3-turbo` upstream?

**No. Snapshot it; don't live-track it.** Treat the fork as a one-time scaffold and get ongoing upgrades from the underlying tools instead. Reasons:

- **It's a scaffold, not a semver library.** Its "releases" are commits on a moving `main` with no stable API or upgrade path — there is nothing to `npm update` to.
- **The Supabase swap guarantees divergence.** Removing `packages/auth` + `packages/db`, dropping tRPC, and reshaping `packages/api` (§4.5) changes *exactly the files upstream churns most* (auth wiring, tRPC routers, Drizzle schema). A `git merge` from upstream would conflict heavily and risk reintroducing the layer we deliberately deleted.
- **The template's value is one-time plumbing.** Its worth is wiring Expo + Next + Expo Router + NativeWind + shadcn + Turborepo + CI together *once*. That plumbing is then upgraded through each tool's own channel — not through the template.

**What to do instead:**
- **Pin provenance, not a remote.** Record the upstream commit SHA you forked from in `NOTICE` (attribution + reproducibility). Don't keep an `upstream` remote you expect to merge.
- **Cherry-pick, never merge.** If upstream later ships a discrete fix to retained plumbing (a CI/Turborepo tweak, an Expo Router config fix), cherry-pick or hand-apply that one commit. Budget it as rare manual work.
- **Lean on per-tool upgrades.** Next codemods, `expo install --fix` + SDK guides, Tailwind/NativeWind releases, and the AI/Stripe/Supabase SDKs' own upgrade docs are where ~95% of "staying current" actually happens.

**Is that realistic? Yes** — it's the normal lifecycle of a forked starter. You give up "free" upstream merges (which were never reliable once the backend was swapped) in exchange for a clean, fully patchable dependency tree.

### 9.4 Update mechanics by component

| Component | Channel | How to patch | Cadence |
|---|---|---|---|
| AI SDK (`ai`, `@ai-sdk/*`) | npm / catalog | `pnpm update` / Renovate | often (v6 moves fast) |
| Chat SDK (`chat`, optional) | npm | `pnpm update` | as needed |
| Stripe SDKs | npm / catalog | `pnpm update`; mind the pinned Stripe API version | on Stripe API changes |
| `@supabase/supabase-js` | npm / catalog | `pnpm update` / Renovate | routine |
| Next.js | npm | `npx @next/codemod` + upgrade guide | per major |
| Expo SDK + `expo-*` | npm via Expo | `expo install --fix` + SDK upgrade guide | per SDK (~quarterly) |
| React / React Native | npm via Expo | follow the Expo SDK pin | with the Expo SDK |
| Tailwind / NativeWind | npm / catalog | `pnpm update` | routine |
| shadcn/ui | registry copy-in | `pnpm ui-add <c>`, diff & reapply | when needed |
| react-native-reusables | registry copy-in | re-add from registry | when needed |
| `liquid-glass-react` | npm | `pnpm update` | optional |
| **create-t3-turbo** | scaffold snapshot | **cherry-pick only** (§9.3) | rare / manual |
| Chatbot template | reference only | re-read & re-port patterns | rare |

---

## 10. Caveats & gotchas

- **Store billing rules.** Digital subscriptions sold *in-app* must use Apple/Google billing — this starter sells on the **web** only; in-app billing is out of scope (§4.6, §7).
- **Glass performance & browser support.** Heavy backdrop-blur is costly to render and can hurt contrast/legibility; `liquid-glass-react`'s refraction only shows in Chromium. Use glass as an accent (§4.4).
- **Push needs a dev build.** Remote push stopped working in Expo Go on Android as of Expo SDK 53 — test in a dev build, not Expo Go (§4.9).
- **AI Gateway model slugs change frequently.** Resolve them dynamically (`gateway.getAvailableModels()`) or from the docs; don't hardcode (§4.7).
- **Apache-2.0, not MIT, on the Vercel libraries.** Handle attribution as in §8 if you copy their source; nothing to do if you only depend via npm.
- **Auth is Supabase Auth + RLS.** The base's Better Auth + tRPC/Drizzle layer is replaced (§4.5).
- **Don't live-track the base fork.** After the Supabase swap, merging upstream `create-t3-turbo` conflicts in the layer you removed — snapshot the fork, pin its commit SHA in `NOTICE`, and cherry-pick discrete fixes instead (§9.3). Patchable npm deps (AI SDK, Stripe, Supabase, Expo, etc.) update normally via the pnpm catalog + `expo install --fix` (§9.1–9.2).
