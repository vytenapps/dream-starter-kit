import { NextResponse } from "next/server";

import { getBootstrapStatus } from "~/lib/db/bootstrap-status";

/**
 * Public health surface for the runtime DB bootstrap (lib/db/bootstrap.ts):
 * did this server instance provision/verify the database on boot?
 *
 *   { status: "ok" | "skipped:<reason>" | "error" | "not-run",
 *     appliedVersions, cmsRoleCreated, error? }
 *
 * `error` is pre-sanitized (code + redacted message, never the connection
 * string) and `appliedVersions` are the committed migration versions — safe
 * for anonymous eyes. The e2e suite asserts on this endpoint
 * (tooling/web-e2e/src/founder.setup.ts), and the README's deploy checklist
 * points founders here when a fresh deploy misbehaves.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  const status = getBootstrapStatus();
  return NextResponse.json(status, {
    status: status.status === "error" ? 503 : 200,
  });
}
