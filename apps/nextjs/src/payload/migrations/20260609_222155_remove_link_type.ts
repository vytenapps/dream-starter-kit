import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cms"."theme_settings" DROP COLUMN "brand_link_type";
  ALTER TABLE "cms"."_theme_settings_v" DROP COLUMN "version_brand_link_type";
  DROP TYPE "cms"."enum_theme_settings_brand_link_type";
  DROP TYPE "cms"."enum__theme_settings_v_version_brand_link_type";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "cms"."enum_theme_settings_brand_link_type" AS ENUM('internal', 'external');
  CREATE TYPE "cms"."enum__theme_settings_v_version_brand_link_type" AS ENUM('internal', 'external');
  ALTER TABLE "cms"."theme_settings" ADD COLUMN "brand_link_type" "cms"."enum_theme_settings_brand_link_type" DEFAULT 'internal';
  ALTER TABLE "cms"."_theme_settings_v" ADD COLUMN "version_brand_link_type" "cms"."enum__theme_settings_v_version_brand_link_type" DEFAULT 'internal';`)
}
