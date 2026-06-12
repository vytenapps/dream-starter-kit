import { MigrateDownArgs, MigrateUpArgs, sql } from "@payloadcms/db-postgres";

// Best-effort teardown for the removed "demo" extension's cms tables
// (pnpm ext remove). VERIFY the table list — array/child tables may differ.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "cms"."ext_demo_settings" CASCADE;
  DROP TABLE IF EXISTS "cms"."ext_demo_settings_rels" CASCADE;
  DROP TABLE IF EXISTS "cms"."_ext_demo_settings_v" CASCADE;
  DROP TABLE IF EXISTS "cms"."_ext_demo_settings_v_rels" CASCADE;
  `);
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Irreversible — restore from a backup if needed.
}
