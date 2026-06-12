import { createHash } from "node:crypto";

import { requireAdmin } from "~/lib/ext/admin-ops";
import { createAdminClient } from "~/lib/supabase/admin";

/**
 * ZIP install path (docs/EXTENSIONS-PLAN.md §6): staff upload → private
 * `extension-uploads` bucket → short-lived signed URL + sha256 returned; the
 * caller dispatches the workflow with both and the runner re-verifies the
 * hash. The install still lands as a PR — never a direct commit.
 */
const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.name.endsWith(".zip")) {
    return Response.json({ error: "Upload a .zip file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: "Zip too large (20MB max)" },
      { status: 413 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  // Cheap shape check before accepting: a zip with extension.config.ts inside.
  if (!bytes.subarray(0, 2).equals(Buffer.from("PK"))) {
    return Response.json({ error: "Not a zip archive" }, { status: 400 });
  }
  if (!bytes.includes(Buffer.from("extension.config.ts"))) {
    return Response.json(
      { error: "Zip does not contain an extension.config.ts" },
      { status: 400 },
    );
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const objectPath = `${Date.now()}-${file.name}`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from("extension-uploads")
    .upload(objectPath, bytes, { contentType: "application/zip" });
  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: signed, error: signError } = await admin.storage
    .from("extension-uploads")
    .createSignedUrl(objectPath, 60 * 30);
  if (signError) {
    return Response.json({ error: signError.message }, { status: 500 });
  }

  return Response.json({ url: signed.signedUrl, sha256 });
}
