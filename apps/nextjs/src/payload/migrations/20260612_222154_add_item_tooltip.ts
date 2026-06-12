import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cms"."pages_blocks_items_items" ADD COLUMN "tooltip" varchar;
  ALTER TABLE "cms"."_pages_v_blocks_items_items" ADD COLUMN "tooltip" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cms"."pages_blocks_items_items" DROP COLUMN "tooltip";
  ALTER TABLE "cms"."_pages_v_blocks_items_items" DROP COLUMN "tooltip";`)
}
