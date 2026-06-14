import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { handleTokenRequest, OAuthError } from "@acme/mcp";

import {
  getMcpOAuthConfig,
  getMcpStoreClient,
  isMcpEnabled,
} from "~/lib/mcp/config";
import { corsJson, corsPreflight } from "~/lib/mcp/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** OAuth 2.1 token endpoint: authorization_code + refresh_token grants. */
export async function POST(req: NextRequest) {
  if (!isMcpEnabled()) return new NextResponse("Not found", { status: 404 });

  // Tokens are requested as application/x-www-form-urlencoded (OAuth standard);
  // accept JSON too for lenient clients.
  let form: URLSearchParams;
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as Record<string, string>;
      form = new URLSearchParams(body);
    } else {
      form = new URLSearchParams(await req.text());
    }
  } catch {
    return corsJson(
      { error: "invalid_request", error_description: "Malformed request body" },
      { status: 400 },
    );
  }

  try {
    const tokens = await handleTokenRequest(
      getMcpStoreClient(),
      getMcpOAuthConfig(),
      form,
    );
    return corsJson(tokens, {
      // OAuth tokens must never be cached.
      headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
    });
  } catch (err) {
    if (err instanceof OAuthError) {
      return corsJson(
        { error: err.error, error_description: err.description },
        { status: err.status },
      );
    }
    throw err;
  }
}

export function OPTIONS() {
  return corsPreflight();
}
