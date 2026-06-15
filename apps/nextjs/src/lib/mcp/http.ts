import "server-only";

import { NextResponse } from "next/server";

/**
 * Shared HTTP helpers for the MCP + OAuth route handlers. Browser-based MCP
 * clients (e.g. the MCP Inspector) make cross-origin requests, so the OAuth
 * discovery/token endpoints and the MCP endpoint send permissive CORS headers
 * and answer preflight.
 */
export const MCP_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, mcp-protocol-version, mcp-session-id",
  "Access-Control-Expose-Headers": "WWW-Authenticate, mcp-session-id",
  "Access-Control-Max-Age": "86400",
};

/** JSON response with CORS headers attached. */
export function corsJson(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> },
): NextResponse {
  return NextResponse.json(body as Record<string, unknown>, {
    status: init?.status ?? 200,
    headers: { ...MCP_CORS_HEADERS, ...init?.headers },
  });
}

/** 204 preflight response. */
export function corsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: MCP_CORS_HEADERS });
}
