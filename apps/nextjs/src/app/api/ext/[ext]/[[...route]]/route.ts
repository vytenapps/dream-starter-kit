import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient as createBearerClient } from "@supabase/supabase-js";

import type { Database } from "@acme/api";
import type { ExtRouteContext } from "@acme/ext-kit/server";
import { slidingWindow } from "@acme/config";

import { env, supabaseAnonKey } from "~/env";
import {
  extPublicRoutes,
  extServerRoutes,
} from "~/ext/registry.server.generated";
import { isExtensionEnabled } from "~/lib/ext/enabled";
import { createClient as createCookieClient } from "~/lib/supabase/server";

/**
 * The ONE server entry point for every extension API route
 * (docs/EXTENSIONS-PLAN.md §2): /api/ext/<slug>/<path> resolves the slug in
 * the generated server registry, then runs host-owned middleware in a single
 * choke point — auth (both session styles), rate limiting, enablement —
 * before invoking the extension's "METHOD /path" handler. This is how golden
 * rule #6 (authed, rate-limited server routes) holds for every extension
 * endpoint; extensions write zero auth code.
 *
 * Public/signature-verified endpoints (Stripe webhooks) do NOT go through
 * here by design — they live in edge functions or Payload plugin endpoints.
 */

// Shared budget across all of a user's extension calls. In-memory per
// instance, same trade-off as /api/chat — swap for Redis/Upstash in prod
// if you need a global limit.
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;
const hitsByUser = new Map<string, number[]>();

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

/**
 * Authenticate either session style:
 *  - native: `Authorization: Bearer <access token>` (the EXPO_PUBLIC pattern),
 *  - web: the Supabase session cookie.
 * Both yield an RLS-scoped client — extension queries run as the caller.
 */
async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    const supabase = createBearerClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey(),
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;
    return { user, supabase };
  }

  const supabase = await createCookieClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { user, supabase };
}

// Guarded (lib/cms/payload-client.ts): fails fast while the CMS database is
// down/unprovisioned instead of hammering the pooler per request, and re-runs
// the DB bootstrap when a fresh deploy's boot attempt failed.
const getPayloadLazy = async () => {
  const { getPayloadClient } = await import("~/lib/cms/payload-client");
  return getPayloadClient();
};

function rateLimit(key: string): boolean {
  const now = Date.now();
  const { allowed, hits } = slidingWindow(
    hitsByUser.get(key) ?? [],
    now,
    RATE_WINDOW_MS,
    RATE_LIMIT,
  );
  hitsByUser.set(key, hits);
  return allowed;
}

async function dispatch(
  req: NextRequest,
  { params }: { params: Promise<{ ext: string; route?: string[] }> },
): Promise<Response> {
  const { ext, route } = await params;

  const table = extServerRoutes[ext];
  const publicTable = extPublicRoutes[ext];
  if ((!table && !publicTable) || !(await isExtensionEnabled(ext))) {
    return json(404, { error: "Not found" });
  }

  const path = `/${(route ?? []).join("/")}`;
  const key = `${req.method} ${path}`;

  // PUBLIC routes first (manifest server.publicRoutes — e.g. guest checkout):
  // no session required; rate-limited per user when present, per IP otherwise.
  const publicHandler = publicTable?.[key];
  if (publicHandler) {
    const supabase = await createCookieClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const limiterKey =
      user?.id ??
      `ip:${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`;
    if (!rateLimit(limiterKey)) {
      return json(429, { error: "Rate limit exceeded. Try again shortly." });
    }
    return publicHandler(req, {
      user,
      supabase,
      params: {},
      getPayload: getPayloadLazy,
    });
  }

  if (!table) return json(404, { error: "Not found" });

  const auth = await authenticate(req);
  if (!auth) return json(401, { error: "Unauthorized" });

  if (!rateLimit(auth.user.id)) {
    return json(429, { error: "Rate limit exceeded. Try again shortly." });
  }

  const handler = table[key];
  if (!handler) {
    const pathExists = Object.keys(table).some((k) => k.endsWith(` ${path}`));
    return pathExists
      ? json(405, { error: "Method not allowed" })
      : json(404, { error: "Not found" });
  }

  const ctx: ExtRouteContext = {
    user: auth.user,
    supabase: auth.supabase,
    params: {},
    getPayload: getPayloadLazy,
  };

  // Streaming responses pass through untouched.
  return handler(req, ctx);
}

export {
  dispatch as GET,
  dispatch as POST,
  dispatch as PUT,
  dispatch as PATCH,
  dispatch as DELETE,
};
