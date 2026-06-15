import { NextResponse } from "next/server";

import { protectedResourceMetadata } from "@acme/mcp";

import { isMcpEnabled } from "~/lib/mcp/config";
import { corsJson, corsPreflight } from "~/lib/mcp/http";
import { getSiteUrl } from "~/lib/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** RFC 9728 — tells MCP clients which authorization server protects /mcp. */
export function GET() {
  if (!isMcpEnabled()) return new NextResponse("Not found", { status: 404 });
  return corsJson(protectedResourceMetadata(getSiteUrl()));
}

export function OPTIONS() {
  return corsPreflight();
}
