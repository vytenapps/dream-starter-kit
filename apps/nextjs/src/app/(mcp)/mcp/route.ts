import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { McpToolContext } from "@acme/mcp";
import {
  handleMcpRequest,
  issuerIdentifier,
  resolveStaffPayloadUser,
  resourceIdentifier,
  verifyAccessToken,
} from "@acme/mcp";

import { getMcpOAuthConfig, isMcpEnabled } from "~/lib/mcp/config";
import { corsPreflight, MCP_CORS_HEADERS } from "~/lib/mcp/http";
import { getSiteUrl } from "~/lib/site-url";

// MCP tool calls chain Payload Local API ops on a small pool; give them room.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const getPayloadLazy = async () => {
  const [{ default: config }, { getPayload }] = await Promise.all([
    import("@payload-config"),
    import("payload"),
  ]);
  return getPayload({ config });
};

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

  return { payload, user, origin };
}

async function dispatch(req: NextRequest): Promise<Response> {
  const origin = getSiteUrl();
  if (!isMcpEnabled()) return new NextResponse("Not found", { status: 404 });

  const auth = await authenticate(req, origin);
  if (auth instanceof NextResponse) return auth;

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
