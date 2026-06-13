import { NextResponse } from "next/server";

import { cmsConfigStatus } from "~/lib/cms/env-status";
import { getBootstrapStatus } from "~/lib/db/bootstrap-status";

/**
 * Public health surface for the runtime DB bootstrap (lib/db/bootstrap.ts):
 * did this server instance provision/verify the database on boot?
 *
 *   { status: "ok" | "skipped:<reason>" | "error" | "not-run",
 *     appliedVersions, cmsRoleCreated, cmsWarmed, error?,
 *     cms: { configured, missing } }
 *
 * `cmsWarmed` is whether the bootstrap ran Payload's migrate/warm-up under its
 * lock at boot — true on a fresh project. The e2e health gate asserts it, so a
 * regression that defers CMS init back to the request path (the first-deploy
 * /welcome 500 class) turns the gate red.
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
  // CMS config state (var NAMES only, never values): explicit env, derived
  // from the Supabase integration env, or unconfigured — so a broken /admin
  // or seed flow is diagnosable from one URL.
  return NextResponse.json(
    { ...status, cms: cmsConfigStatus() },
    { status: status.status === "error" ? 503 : 200 },
  );
}
