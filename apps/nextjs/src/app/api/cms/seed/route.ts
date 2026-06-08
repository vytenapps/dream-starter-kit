import { headers } from "next/headers";
import { NextResponse } from "next/server";
import config from "@payload-config";
import { getPayload } from "payload";

import { seedCmsContent } from "~/payload/seed";

/**
 * Auto-seed endpoint for the first-admin onboarding flow (`/cms-setup`).
 * Authenticated via the PAYLOAD admin session (not Supabase) — the caller has
 * just created the first admin and is logged into the CMS.
 *
 *   GET  → { seeded: boolean }   (cheap status check used by the dashboard gate)
 *   POST → streams newline-delimited JSON progress events while seeding:
 *            { done, total, label }      one per step
 *            { done: total, label: "Done", complete: true }
 *          or, if content already exists, { alreadySeeded: true }.
 *
 * Idempotent: seeding bails when pages already exist, so re-POSTing is a no-op.
 */
export const dynamic = "force-dynamic";

async function authedPayload() {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await headers() });
  return { payload, user };
}

export async function GET() {
  const { payload, user } = await authedPayload();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const pages = await payload.find({ collection: "pages", limit: 0 });
  return NextResponse.json({ seeded: pages.totalDocs > 0 });
}

export async function POST() {
  const { payload, user } = await authedPayload();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await payload.find({ collection: "pages", limit: 0 });
  if (existing.totalDocs > 0) {
    return NextResponse.json({ seeded: false, alreadySeeded: true });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const { seeded } = await seedCmsContent(payload, (done, total, label) =>
          send({ done, total, label }),
        );
        send({ done: 1, total: 1, label: "Done", complete: true, seeded });
      } catch (err) {
        payload.logger.error(err);
        send({ error: "Seeding failed. Please retry." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
    },
  });
}
