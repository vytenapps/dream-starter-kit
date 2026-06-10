import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "cms"."enum_pricing_settings_billing_toggle_default" AS ENUM('monthly', 'annual');
  ALTER TABLE "cms"."site_settings" ADD COLUMN "site_name" varchar;
  ALTER TABLE "cms"."site_settings" ADD COLUMN "site_description" varchar;
  ALTER TABLE "cms"."site_settings" ADD COLUMN "contact_email" varchar;
  ALTER TABLE "cms"."site_settings" ADD COLUMN "default_meta_title" varchar;
  ALTER TABLE "cms"."site_settings" ADD COLUMN "default_meta_description" varchar;
  ALTER TABLE "cms"."site_settings" ADD COLUMN "default_meta_image_id" integer;
  ALTER TABLE "cms"."site_settings" ADD COLUMN "social_instagram" varchar;
  ALTER TABLE "cms"."site_settings" ADD COLUMN "social_facebook" varchar;
  ALTER TABLE "cms"."site_settings" ADD COLUMN "social_youtube" varchar;
  ALTER TABLE "cms"."site_settings" ADD COLUMN "social_linkedin" varchar;
  ALTER TABLE "cms"."pricing_settings_free_tier_features" ADD COLUMN "included" boolean DEFAULT true;
  ALTER TABLE "cms"."pricing_settings" ADD COLUMN "billing_toggle_default" "cms"."enum_pricing_settings_billing_toggle_default" DEFAULT 'monthly';
  ALTER TABLE "cms"."pricing_settings" ADD COLUMN "free_tier_link_url" varchar;
  ALTER TABLE "cms"."pricing_settings" ADD COLUMN "free_tier_link_new_tab" boolean DEFAULT false;
  ALTER TABLE "cms"."pricing_settings" ADD COLUMN "disclaimer" varchar;
  ALTER TABLE "cms"."site_settings" ADD CONSTRAINT "site_settings_default_meta_image_id_media_id_fk" FOREIGN KEY ("default_meta_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "site_settings_default_meta_default_meta_image_idx" ON "cms"."site_settings" USING btree ("default_meta_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cms"."site_settings" DROP CONSTRAINT "site_settings_default_meta_image_id_media_id_fk";
  
  DROP INDEX "cms"."site_settings_default_meta_default_meta_image_idx";
  ALTER TABLE "cms"."site_settings" DROP COLUMN "site_name";
  ALTER TABLE "cms"."site_settings" DROP COLUMN "site_description";
  ALTER TABLE "cms"."site_settings" DROP COLUMN "contact_email";
  ALTER TABLE "cms"."site_settings" DROP COLUMN "default_meta_title";
  ALTER TABLE "cms"."site_settings" DROP COLUMN "default_meta_description";
  ALTER TABLE "cms"."site_settings" DROP COLUMN "default_meta_image_id";
  ALTER TABLE "cms"."site_settings" DROP COLUMN "social_instagram";
  ALTER TABLE "cms"."site_settings" DROP COLUMN "social_facebook";
  ALTER TABLE "cms"."site_settings" DROP COLUMN "social_youtube";
  ALTER TABLE "cms"."site_settings" DROP COLUMN "social_linkedin";
  ALTER TABLE "cms"."pricing_settings_free_tier_features" DROP COLUMN "included";
  ALTER TABLE "cms"."pricing_settings" DROP COLUMN "billing_toggle_default";
  ALTER TABLE "cms"."pricing_settings" DROP COLUMN "free_tier_link_url";
  ALTER TABLE "cms"."pricing_settings" DROP COLUMN "free_tier_link_new_tab";
  ALTER TABLE "cms"."pricing_settings" DROP COLUMN "disclaimer";
  DROP TYPE "cms"."enum_pricing_settings_billing_toggle_default";`)
}
