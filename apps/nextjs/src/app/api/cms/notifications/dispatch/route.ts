import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { runDispatch } from "@acme/mcp";

import { env } from "~/env";
import { summarizeDbError } from "~/lib/db/bootstrap-core";
import { createAdminClient } from "~/lib/supabase/admin";

/**
 * Scheduled dispatcher for Payload `notifications` (status=scheduled). Sends due
 * notifications — Expo push + in-app feed rows — and writes back
 * sentAt/sentCount. Runs in-app (not an edge function) because it needs BOTH
 * the Payload Local API (cms schema) and the service-role Supabase client
 * (public schema: device tokens + ext_notifications); see packages/mcp dispatch.
 *
 * Triggered by Vercel Cron every minute (apps/nextjs/vercel.json). Vercel adds
 * `Authorization: Bearer ${CRON_SECRET}` to cron requests; pg_cron / manual
 * callers must send the same header. Modeled on supabase/functions/
 * reminders-process (which dispatches ext_reminders the same way).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const getPayloadLazy = async () => {
  const { getPayloadClient } = await import("~/lib/cms/payload-client");
  return getPayloadClient();
};

async function handler(req: NextRequest): Promise<Response> {
  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // The guarded client re-runs the DB bootstrap when a fresh deploy's boot
  // attempt failed — this cron is the deployment's steady background healer.
  // Answer a clean 503 (instead of crashing the invocation) while the
  // database still isn't reachable/provisioned.
  let payload;
  try {
    payload = await getPayloadLazy();
  } catch (error) {
    return NextResponse.json(
      { error: "CMS database unavailable", detail: summarizeDbError(error) },
      { status: 503 },
    );
  }
  const admin = createAdminClient();
  const result = await runDispatch({ payload, admin });
  return NextResponse.json(result);
}

// Vercel Cron sends GET; allow POST for pg_cron / manual triggering.
export { handler as GET, handler as POST };
