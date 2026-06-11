import { NextResponse } from "next/server";

import { missingCmsEnv } from "~/lib/cms/env-status";
import { getBootstrapStatus } from "~/lib/db/bootstrap-status";

/**
 * Public health surface for the runtime DB bootstrap (lib/db/bootstrap.ts):
 * did this server instance provision/verify the database on boot?
 *
 *   { status: "ok" | "skipped:<reason>" | "error" | "not-run",
 *     appliedVersions, cmsRoleCreated, error?,
 *     cms: { configured, missing } }
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
  // CMS env completeness (var NAMES only, never values): the bootstrap skips
  // cms provisioning when PAYLOAD_DATABASE_URL is unset, and Payload can't
  // init without PAYLOAD_SECRET — surface both here so a broken /admin or
  // seed flow is diagnosable from one URL.
  const missing = missingCmsEnv();
  return NextResponse.json(
    { ...status, cms: { configured: missing.length === 0, missing } },
    { status: status.status === "error" ? 503 : 200 },
  );
}
