# MCP reference — the remote Model Context Protocol server

The kit ships a **remote MCP server** hosted inside the Next.js web app. A workspace
admin connects an MCP client (Claude, ChatGPT, Cursor, or anything that speaks MCP) and
manages **Payload CMS content** and **push notifications** in natural language — search,
read, create, update, delete content, and author/schedule notifications.

It is **core infrastructure, not an extension** (MCP clients fetch auth metadata from
domain-root `/.well-known/oauth-*` and connect to `/mcp`, which the extension mount
point `/api/ext/<slug>` can't serve). All logic lives in the server-only package
**`@acme/mcp` (`packages/mcp`)**; thin Next.js route handlers wire it in and **inject**
Payload + the service-role Supabase client, so the package is framework-agnostic,
unit-testable, and never enters the Expo bundle.

- **Package:** `packages/mcp` — see also [`ARCHITECTURE.md` §4.12](./ARCHITECTURE.md#412-remote-mcp-server--acmemcp)
- **Endpoint:** `POST /mcp` · **OAuth:** `/oauth/*` + `/.well-known/oauth-*`
- **Notifications dispatch:** `/api/cms/notifications/dispatch` (see [`CMS.md` → `notifications`](./CMS.md))

---

## Enabling it

The entire MCP surface (`/mcp`, `/oauth/*`, `/.well-known/oauth-*`) **404s until
configured.** Two server-only env vars (zod schema in `packages/config/env` +
`apps/nextjs/src/env.ts`, documented in `.env.example`):

| Variable         | Required   | Notes                                                                             |
| ---------------- | ---------- | --------------------------------------------------------------------------------- |
| `MCP_JWT_SECRET` | to turn on | HMAC secret signing OAuth access-token JWTs. Generate: `openssl rand -base64 32`. |
| `MCP_ENABLED`    | optional   | Explicit kill switch — set to `"off"` to disable even when the secret is present. |

`isMcpConfigured()` / `isMcpEnabled()` gate every route. There is **no** separate
provider signup — auth reuses your existing Supabase login.

> The notification **dispatch worker** is independent of MCP and uses `CRON_SECRET`
> (it sends scheduled notifications whether or not MCP is enabled).

---

## Connecting a client

The connection URL is your deployed origin + `/mcp`, e.g. `https://your-app.com/mcp`
(locally `http://localhost:3000/mcp`). Add it as a **custom/remote MCP connector**:

- **Claude** (web, desktop, Code): add a custom connector with the `/mcp` URL. Claude
  opens a browser, you sign in with your normal Supabase credentials, and you're
  connected. (Staff only — see below.)
- **ChatGPT** (connectors / developer mode): add the `/mcp` URL; it runs the same OAuth
  browser flow. The kit exposes the `search` and `fetch` tools ChatGPT connectors expect.
- **Cursor** and other clients: point them at the `/mcp` URL; they discover OAuth from
  the `.well-known` metadata automatically.

**Who can connect:** only users whose `profiles.is_staff = true` (the same gate as
`/admin`). Signing in **is** the consent — there is no second approval screen. A
non-staff user who authenticates is denied with an OAuth `access_denied`.

---

## How auth works (OAuth 2.1)

The app is its own OAuth 2.1 **authorization server**, implementing the MCP
authorization spec. Endpoints (all under `apps/nextjs/src/app/`):

| Path                                      | Purpose                                                    |
| ----------------------------------------- | ---------------------------------------------------------- |
| `/.well-known/oauth-protected-resource`   | RFC 9728 — advertises `/mcp` + its authorization server    |
| `/.well-known/oauth-authorization-server` | RFC 8414 — endpoints, PKCE (S256), grant types             |
| `POST /oauth/register`                    | RFC 7591 dynamic client registration (rate-limited per IP) |
| `GET /oauth/authorize`                    | Authorization endpoint — reuses Supabase `/sign-in`        |
| `POST /oauth/token`                       | `authorization_code` + `refresh_token` grants              |

**Flow:**

1. The client fetches the `.well-known` metadata and (if new) self-registers at
   `/oauth/register`, receiving a `client_id` (public client, PKCE, no secret).
2. It opens `/oauth/authorize?...&code_challenge=…&code_challenge_method=S256`.
   - **Anonymous?** The route redirects to the existing
     **`/sign-in?redirectTo=/oauth/authorize?…`** — whatever login methods your site
     has enabled (password, Google/Apple, magic link) all work. After login the user
     lands back on `/oauth/authorize`, now authenticated.
   - **Signed in + staff?** An authorization `code` (single-use, ~60s TTL, bound to the
     PKCE challenge) is issued and the user is redirected back to the client.
   - **Signed in but not staff?** Denied via `error=access_denied`.
3. The client exchanges the code at `/oauth/token` with its `code_verifier` (PKCE
   verified). It receives a short-lived **access token** + a **refresh token**.
4. Every `/mcp` request carries `Authorization: Bearer <access token>`.

**Tokens.** Access tokens are **stateless HS256 JWTs** (`jose`, signed with
`MCP_JWT_SECRET`) — verified on every request with no DB hit (issuer/audience/expiry
checked). Refresh tokens are **opaque, stored only as a SHA-256 hash, and rotate on
use**; replaying a rotated token is treated as compromise and revokes the whole chain
for that user+client (reuse detection).

**Storage.** Three **server-only** tables in `public` —
`mcp_oauth_clients`, `mcp_authorization_codes`, `mcp_refresh_tokens` (migration
`supabase/migrations/20260614120000_mcp_oauth.sql`). Unlike every other `public` table
they are **deny-all**: RLS is enabled with **no policies**, and privileges are revoked
from `anon`/`authenticated`/`payload_cms`. Only the service-role client (BYPASSRLS)
touches them. The RLS suite (`tooling/rls-tests`) asserts this.

**Proxy.** `apps/nextjs/src/proxy.ts` bypasses Supabase session refresh for the
bearer/DCR endpoints (`/mcp`, `/.well-known/oauth-`, `/oauth/register`, `/oauth/token`).
`/oauth/authorize` flows through normally so it can read the session.

---

## The MCP endpoint

`/mcp` (`apps/nextjs/src/app/(mcp)/mcp/route.ts`) uses the MCP SDK's **Web-standard
Streamable HTTP transport in stateless mode** (`@modelcontextprotocol/sdk`) — no session
store, ideal for serverless. Per request it:

1. Verifies the bearer JWT. Missing/invalid → **`401`** with
   `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource"`
   (this header is what makes the client start the OAuth flow — required).
2. Resolves the staff `cms.users` row from the token's `sub` (rejects missing/trashed/
   non-staff → `403`).
3. Runs **every tool through the Payload Local API as that user with
   `overrideAccess: false`** — so Payload's role-based access control
   (`payload/access`) is enforced exactly as in `/admin`. The MCP can never do what the
   signed-in admin couldn't.

`runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 60`.

---

## Tools

| Tool               | Input                                                                  | Does                                                                 |
| ------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `list_collections` | —                                                                      | Lists allowlisted collections (+ your roles). Call this first.       |
| `search_content`   | `collection`, `query?`, `limit?`, `page?`                              | Paginated search of a collection (title/text fields).                |
| `read_content`     | `collection`, `id`                                                     | One document, relationships one level deep.                          |
| `create_content`   | `collection`, `data`                                                   | Create a document (Payload validates; rejects fields you can't set). |
| `update_content`   | `collection`, `id`, `data`                                             | Update changed fields.                                               |
| `delete_content`   | `collection`, `id`                                                     | Delete (soft-delete → Trash where the collection has `trash`).       |
| `notify_create`    | `title`, `body?`, `channel?`, `audience?`, `targetUsers?`, `deepLink?` | Create a **draft** notification.                                     |
| `notify_schedule`  | …same + `scheduledAt?`                                                 | Create + **schedule** (status `scheduled`; defaults to "now").       |
| `notify_list`      | `status?`, `limit?`                                                    | Recent notifications, newest first.                                  |
| `notify_cancel`    | `id`                                                                   | Unschedule (back to draft) — only before it's sent.                  |
| `search`           | `query`                                                                | **ChatGPT-compatible** — `{ results: [{ id, title, url }] }`.        |
| `fetch`            | `id` (`collection:id`)                                                 | **ChatGPT-compatible** — full `{ id, title, text, url, metadata }`.  |

Every tool returns its result as JSON text content; failures (e.g. a Payload permission
or validation error) come back as a readable `isError` result, not a transport crash.

### The collection allowlist

The tools operate over an allowlist defined in `packages/mcp/src/tools/registry.ts`
(`MCP_COLLECTIONS`) — editorial, community, and marketing content plus `notifications`.
**Auth/PII-management collections (`users`, `device-tokens`, `feed-tokens`) and internal
ones (`media`, `nav-items`, `kit-extensions`) are intentionally excluded.** Per-operation
authorization is still Payload's job; the allowlist just bounds the surface.

**To expose another collection,** add an entry (slug, label, group, `titleField`,
`searchFields`, optional `publicPath`, optional `chatgptSearch`) to `MCP_COLLECTIONS`.
The `collection` enum on the content tools and `list_collections` update automatically.

---

## Notifications & delivery

`notify_schedule` writes a Payload `notification` with `status: "scheduled"` and a
`scheduledAt`. Delivery is performed by the **dispatch worker** at
`POST /api/cms/notifications/dispatch` (`apps/nextjs/src/app/api/cms/notifications/dispatch/route.ts`),
triggered by **Vercel Cron** every minute (`apps/nextjs/vercel.json`) and guarded by
`CRON_SECRET` (Vercel adds the bearer automatically; pg_cron/manual callers send the same
header).

The worker core is pure and injectable (`packages/mcp/src/dispatch/run-dispatch.ts`). Per
due notification it: claims the row (`status → sending`, so overlapping runs don't
double-send), resolves the audience —

- `all` → every member,
- `users` → `targetUsers` mapped via `cms.users.supabaseUserId`,
- `segment` → a minimal `{ tags: ["…"] }` filter against `public.user_tags`,

— then fans out **Expo push** (batched ≤100) to `public.ext_notifications_push_tokens`
and inserts **in-app feed** rows into `public.ext_notifications`, and finally writes back
`sentAt`/`sentCount`/`status` (`sent`, or `failed` on error).

It runs **in-app** (not an edge function) because it's the one place with both the Payload
Local API (cms schema) and the service-role client (public schema device tokens + feed).
Email/SMS channels are a documented follow-up. See [`CMS.md` → `notifications`](./CMS.md).

---

## Security model

- **Staff-only**, gated on `profiles.is_staff` at authorize time and re-checked (roles +
  not-trashed) on every `/mcp` request.
- **RBAC enforced by Payload** (`overrideAccess: false` + the resolved user) — an
  `author` who lacks create access on a collection just gets a permission error.
- **PKCE S256 only** (`plain` rejected); single-use short-TTL codes; rotating, hashed
  refresh tokens with reuse detection.
- **Deny-all RLS** on the OAuth tables; service-role key stays server-only (golden rule
  #2). Access-token verification never hits the DB.
- **Origin is never hardcoded** — issuer/resource/metadata URLs come from `getSiteUrl()`.

---

## Testing & verification

Unit/integration (no backend — `pnpm test`):

- `packages/mcp` — PKCE, token mint/verify, the full OAuth flow (auth code + refresh
  rotation + reuse detection) against an in-memory store, the tool layer driven through
  an **in-memory MCP client↔server** against a fake Payload (asserts `overrideAccess:
false` + `user` are passed and the ChatGPT shapes), and the dispatch worker.

Backend-dependent (need `supabase start` + `.env`):

- `pnpm test:rls` — asserts the `mcp_oauth_*` tables are deny-all to anon/authenticated
  and reachable only by the service role.
- End-to-end: set `MCP_JWT_SECRET`, run `next dev`, then drive the OAuth dance and a live
  `tools/call` with the MCP SDK client over Streamable HTTP (Playwright / `tooling/web-e2e`).
- Dispatch: seed a due `scheduled` notification, `POST /api/cms/notifications/dispatch`
  with `Authorization: Bearer $CRON_SECRET`, and assert the row flips to `sent` and an
  `ext_notifications` row was inserted.

---

## Troubleshooting

- **Client can't connect / no login prompt** — `MCP_JWT_SECRET` is unset (everything
  404s), or the `.well-known` URLs don't resolve to your real origin (check
  `NEXT_PUBLIC_SITE_URL` / Vercel origin so `getSiteUrl()` is correct).
- **401 loop** — the client isn't honoring the `WWW-Authenticate` header; confirm it
  supports OAuth remote MCP servers.
- **`access_denied` after login** — that account isn't staff (`profiles.is_staff`).
- **Scheduled notifications never send** — `CRON_SECRET` unset, Vercel Cron not enabled
  (`apps/nextjs/vercel.json`), or no device tokens registered for the audience.
