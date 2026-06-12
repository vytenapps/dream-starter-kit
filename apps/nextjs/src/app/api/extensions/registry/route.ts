import { env } from "~/env";
import { extensionsLock } from "~/ext/lock.generated";
import { extInstalled } from "~/ext/registry.client.generated";
import { opsConfigured, requireAdmin } from "~/lib/ext/admin-ops";

/**
 * Install state for the /admin/extensions page: the BUNDLED lock (readable on
 * serverless; a deploy containing a new version is the honest "Active"
 * signal), the generated registry, and the catalog URL. Staff-gated.
 */
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  return Response.json({
    installed: extInstalled,
    lock: extensionsLock,
    opsConfigured: opsConfigured(),
    catalogUrl: env.EXT_CATALOG_URL ?? null,
  });
}
