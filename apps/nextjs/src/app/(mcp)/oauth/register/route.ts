import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { handleClientRegistration, OAuthError } from "@acme/mcp";
import { slidingWindow } from "@acme/config";

import { getMcpStoreClient, isMcpEnabled } from "~/lib/mcp/config";
import { corsJson, corsPreflight } from "~/lib/mcp/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Open registration (RFC 7591) is expected for MCP, but rate-limit by IP so it
// can't be used to flood the clients table.
const REGISTER_LIMIT = 20;
const REGISTER_WINDOW_MS = 60_000;
const hitsByIp = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const { allowed, hits } = slidingWindow(
    hitsByIp.get(ip) ?? [],
    Date.now(),
    REGISTER_WINDOW_MS,
    REGISTER_LIMIT,
  );
  hitsByIp.set(ip, hits);
  return !allowed;
}

export async function POST(req: NextRequest) {
  if (!isMcpEnabled()) return new NextResponse("Not found", { status: 404 });

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return corsJson(
      { error: "rate_limited", error_description: "Too many registrations" },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return corsJson(
      { error: "invalid_request", error_description: "Body must be JSON" },
      { status: 400 },
    );
  }

  try {
    const registration = await handleClientRegistration(
      getMcpStoreClient(),
      body,
    );
    return corsJson(registration, { status: 201 });
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
