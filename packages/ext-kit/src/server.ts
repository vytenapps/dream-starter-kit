import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { BasePayload } from "payload";

import type { Database } from "@acme/api";

/**
 * Server route contract for extensions (docs/EXTENSIONS-PLAN.md §2).
 *
 * An extension's `./server` entry (first line: `import "server-only"`) exports
 * `routes: ExtRouteTable`. The host's catch-all dispatcher
 * (apps/nextjs/src/app/api/ext/[ext]/[[...route]]/route.ts) authenticates the
 * request (Supabase session cookie on web, `Authorization: Bearer` on native),
 * applies the shared rate limiter, checks the extension is enabled, and only
 * then invokes the matching handler — extension endpoints are authed +
 * rate-limited by construction (golden rule #6).
 */
export interface ExtRouteContext {
  /** The authenticated Supabase user (the dispatcher rejects anonymous traffic). */
  user: User;
  /** RLS-scoped client bound to the caller's session — queries run as the user. */
  supabase: SupabaseClient<Database>;
  /**
   * Reserved for future route-pattern params; route keys are exact
   * "METHOD /path" strings today.
   */
  params: Record<string, string>;
  /**
   * Lazily resolve the host's Payload instance (for `getExtensionSettings`,
   * Local API reads). Lazy so routes that never touch the CMS pay nothing.
   */
  getPayload: () => Promise<BasePayload>;
}

export type ExtRouteHandler = (
  req: Request,
  ctx: ExtRouteContext,
) => Response | Promise<Response>;

/**
 * Keys are exact `"METHOD /path"` strings, e.g. `"POST /stream"`,
 * `"GET /ping"`. The index route is `"GET /"`. Streaming responses pass
 * through the dispatcher untouched.
 */
export type ExtRouteTable = Record<string, ExtRouteHandler>;

/**
 * Context for PUBLIC extension routes (`publicRoutes` export, manifest
 * `server.publicRoutes: true`): the dispatcher does NOT require a session —
 * `user` is null for anonymous callers — but still rate-limits (per user when
 * signed in, per IP otherwise) and gates on enablement. Reserve these for
 * flows that genuinely serve anonymous traffic (e.g. billing's guest
 * checkout); everything else belongs in the authed `routes` table (golden
 * rule #6). Signature-verified endpoints (Stripe webhooks) still belong in
 * edge functions or Payload plugin endpoints, not here.
 */
export interface ExtPublicRouteContext {
  /** The caller, when a session exists — null for anonymous requests. */
  user: User | null;
  /** Cookie/anon-scoped client — RLS still applies to every query. */
  supabase: SupabaseClient<Database>;
  params: Record<string, string>;
  getPayload: () => Promise<BasePayload>;
}

export type ExtPublicRouteHandler = (
  req: Request,
  ctx: ExtPublicRouteContext,
) => Response | Promise<Response>;

export type ExtPublicRouteTable = Record<string, ExtPublicRouteHandler>;

export const EXT_HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
] as const;
export type ExtHttpMethod = (typeof EXT_HTTP_METHODS)[number];
