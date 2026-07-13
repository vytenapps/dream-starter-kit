import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { McpToolContext } from "@acme/mcp";
import { slidingWindow } from "@acme/config";
import {
  handleMcpRequest,
  issuerIdentifier,
  resolveStaffPayloadUser,
  resourceIdentifier,
  verifyAccessToken,
} from "@acme/mcp";

import { getMcpOAuthConfig, isMcpEnabled } from "~/lib/mcp/config";
import { generateMediaAsset } from "~/lib/mcp/generate-media";
import { corsPreflight, MCP_CORS_HEADERS } from "~/lib/mcp/http";
import { getSiteUrl } from "~/lib/site-url";

// MCP tool calls chain Payload Local API ops on a small pool; give them room.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Guarded (lib/cms/payload-client.ts): fails fast while the CMS database is
// down/unprovisioned instead of hammering the pooler per request, and re-runs
// the DB bootstrap when a fresh deploy's boot attempt failed.
const getPayloadLazy = async () => {
  const { getPayloadClient } = await import("~/lib/cms/payload-client");
  return getPayloadClient();
};

// Per-user budget for the cost-bearing MCP surface (golden rule #6: authed AND
// rate-limited). The intended client is an autonomous LLM loop, and tools like
// generate_media hit the AI Gateway, so an unbounded token could burn spend with
// only function-duration as a brake. In-memory per instance, same trade-off as
// the extension dispatcher — swap for Redis/Upstash in prod for a global limit.
const MCP_RATE_LIMIT = 60;
const MCP_RATE_WINDOW_MS = 60_000;
const mcpHitsByUser = new Map<string, number[]>();

function mcpRateLimit(userId: string): boolean {
  const now = Date.now();
  const { allowed, hits } = slidingWindow(
    mcpHitsByUser.get(userId) ?? [],
    now,
    MCP_RATE_WINDOW_MS,
    MCP_RATE_LIMIT,
  );
  mcpHitsByUser.set(userId, hits);
  return allowed;
}

/** 401 with the WWW-Authenticate header that triggers the client's OAuth flow. */
function unauthorized(origin: string): NextResponse {
  return new NextResponse(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: {
      ...MCP_CORS_HEADERS,
      "Content-Type": "application/json",
      "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
    },
  });
}

/**
 * Verify the bearer token and resolve the staff Payload user. Returns the tool
 * context, or a Response (401/403) to short-circuit.
 */
async function authenticate(
  req: NextRequest,
  origin: string,
): Promise<McpToolContext | NextResponse> {
  const authHeader = req.headers.get("authorization") ?? "";
  const match = /^Bearer (.+)$/i.exec(authHeader);
  if (!match) return unauthorized(origin);

  const { jwtSecret } = getMcpOAuthConfig();
  let supabaseUserId: string;
  try {
    const claims = await verifyAccessToken({
      secret: jwtSecret,
      issuer: issuerIdentifier(origin),
      audience: resourceIdentifier(origin),
      token: match[1] ?? "",
    });
    supabaseUserId = claims.sub;
  } catch {
    return unauthorized(origin);
  }

  const payload = await getPayloadLazy();
  const user = await resolveStaffPayloadUser(payload, supabaseUserId);
  if (!user) {
    return new NextResponse(
      JSON.stringify({
        error: "forbidden",
        error_description: "Staff access required",
      }),
      {
        status: 403,
        headers: { ...MCP_CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }

  return {
    payload,
    user,
    origin,
    // Inject the server-only image renderer so @acme/mcp stays framework-agnostic.
    // Runs as this staff user (overrideAccess: false) — see generate-media.ts.
    generateMedia: (args) => generateMediaAsset(payload, user, args),
  };
}

async function dispatch(req: NextRequest): Promise<Response> {
  const origin = getSiteUrl();
  if (!isMcpEnabled()) return new NextResponse("Not found", { status: 404 });

  const auth = await authenticate(req, origin);
  if (auth instanceof NextResponse) return auth;

  // Rate-limit per authenticated staff user (their Payload id is stable).
  if (!mcpRateLimit(String(auth.user.id))) {
    return new NextResponse(
      JSON.stringify({
        error: "rate_limited",
        error_description: "Too many requests. Try again shortly.",
      }),
      {
        status: 429,
        headers: {
          ...MCP_CORS_HEADERS,
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(MCP_RATE_WINDOW_MS / 1000)),
        },
      },
    );
  }

  const res = await handleMcpRequest(req, auth);
  // Attach CORS headers to the transport's response.
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(MCP_CORS_HEADERS)) headers.set(k, v);
  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export {
  dispatch as GET,
  dispatch as POST,
  dispatch as DELETE,
  corsPreflight as OPTIONS,
};
