import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

import { env } from "~/env";
import { createClient } from "~/lib/supabase/server";

/**
 * Draft-preview entry point used by Payload Live Preview. Enables Next.js draft
 * mode, then redirects to the document's public path — where the readers serve
 * the unpublished draft (and, via `getPost`, the premium body regardless of
 * entitlement). Because draft mode unlocks unpublished + premium content, this
 * route must be authorized:
 *   - if `PAYLOAD_PREVIEW_SECRET` is set, the shared secret is required; else
 *   - it requires a signed-in STAFF Supabase session (same gate as /admin).
 * Never open draft mode to anonymous callers — the kit's zero-touch deploy path
 * leaves the secret unset, so a secret-only check would be no check at all.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  const secret = searchParams.get("secret");

  const expected = env.PAYLOAD_PREVIEW_SECRET;
  if (expected) {
    if (secret !== expected) {
      return new Response("Invalid preview secret", { status: 401 });
    }
  } else {
    // No shared secret configured → require a staff session.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response("Preview requires sign-in", { status: 401 });
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_staff")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.is_staff) {
      return new Response("Preview requires staff access", { status: 403 });
    }
  }

  // Only allow same-site relative paths (never an open redirect). Reject a
  // leading `//` or `/\` — browsers treat backslashes as slashes, so `/\evil.com`
  // would resolve to a foreign origin.
  if (!path || !/^\/(?![/\\])/.test(path)) {
    return new Response("Invalid preview path", { status: 400 });
  }

  const draft = await draftMode();
  draft.enable();
  redirect(path);
}
