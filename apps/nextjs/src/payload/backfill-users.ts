/**
 * One-time backfill: mirror existing Supabase users into the Payload `users`
 * collection and give each a default "Free" tag (unless already tagged). New
 * signups are mirrored automatically (see lib/cms/mirror-user.ts); this catches
 * up accounts created before that was in place.
 *
 * Run with `pnpm cms:backfill-users` (needs SUPABASE_SERVICE_ROLE_KEY + the CMS
 * env). Idempotent — safe to re-run.
 */
import { ensureCmsUser, ensureFreeTag } from "~/lib/cms/mirror-user";
import { createAdminClient } from "~/lib/supabase/admin";

async function main() {
  const admin = createAdminClient();
  const perPage = 200;
  let total = 0;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    for (const user of data.users) {
      await ensureCmsUser({
        id: user.id,
        email: user.email,
        name:
          (user.user_metadata.display_name as string | undefined) ??
          (user.user_metadata.name as string | undefined),
        metadata: user.user_metadata,
      });
      await ensureFreeTag(user.id);
      total++;
    }
    if (data.users.length < perPage) break;
  }
  console.log(`Backfilled ${total} user(s).`);
}

void main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
