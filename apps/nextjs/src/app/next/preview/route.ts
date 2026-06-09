import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

import { env } from "~/env";

/**
 * Draft-preview entry point used by Payload Live Preview. Validates the shared
 * secret (when configured), enables Next.js draft mode, then redirects to the
 * document's public path — where `getPage` serves the unpublished draft.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  const secret = searchParams.get("secret");

  const expected = env.PAYLOAD_PREVIEW_SECRET;
  if (expected && secret !== expected) {
    return new Response("Invalid preview secret", { status: 401 });
  }

  // Only allow same-site relative paths (never an open redirect).
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return new Response("Invalid preview path", { status: 400 });
  }

  const draft = await draftMode();
  draft.enable();
  redirect(path);
}
