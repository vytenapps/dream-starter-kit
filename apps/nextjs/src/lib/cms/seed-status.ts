import type { Payload } from "payload";

import { withCmsSchemaHeal } from "./ensure-schema";

/**
 * Whether the CMS has been seeded with the kit's demo content. Mirrors the
 * bail-out check in `payload/seed.ts#seedCmsContent` (pages exist ⇒ seeded) —
 * shared by the seed endpoint (status + idempotency) and `/welcome` (which
 * routes staff straight to /admin once seeding has happened, so returning
 * admins never see the /cms-setup progress screen again).
 *
 * Self-heals a wiped cms schema before answering (lib/cms/ensure-schema.ts);
 * any other failure propagates to the caller.
 */
export async function isCmsSeeded(payload: Payload): Promise<boolean> {
  const pages = await withCmsSchemaHeal(payload, () =>
    payload.find({ collection: "pages", limit: 0 }),
  );
  return pages.totalDocs > 0;
}
