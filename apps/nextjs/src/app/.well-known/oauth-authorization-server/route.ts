import { NextResponse } from "next/server";

import { authorizationServerMetadata } from "@acme/mcp";

import { isMcpEnabled } from "~/lib/mcp/config";
import { corsJson, corsPreflight } from "~/lib/mcp/http";
import { getSiteUrl } from "~/lib/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** RFC 8414 — advertises the OAuth endpoints, PKCE (S256), and DCR. */
export function GET() {
  if (!isMcpEnabled()) return new NextResponse("Not found", { status: 404 });
  return corsJson(authorizationServerMetadata(getSiteUrl()));
}

export function OPTIONS() {
  return corsPreflight();
}
