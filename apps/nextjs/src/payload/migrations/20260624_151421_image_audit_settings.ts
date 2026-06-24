import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "cms"."enum_image_generation_settings_audit_failure_action" AS ENUM('publish', 'skip');
  CREATE TYPE "cms"."enum_image_generation_settings_audit_model" AS ENUM('anthropic/claude-sonnet-4.5', 'anthropic/claude-opus-4.1', 'anthropic/claude-haiku-4.5');
  ALTER TABLE "cms"."image_generation_settings" ADD COLUMN "audit_enabled" boolean DEFAULT false;
  ALTER TABLE "cms"."image_generation_settings" ADD COLUMN "audit_max_attempts" numeric DEFAULT 3;
  ALTER TABLE "cms"."image_generation_settings" ADD COLUMN "audit_failure_action" "cms"."enum_image_generation_settings_audit_failure_action" DEFAULT 'publish';
  ALTER TABLE "cms"."image_generation_settings" ADD COLUMN "audit_model" "cms"."enum_image_generation_settings_audit_model" DEFAULT 'anthropic/claude-sonnet-4.5';
  ALTER TABLE "cms"."image_generation_settings" ADD COLUMN "audit_instructions" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cms"."image_generation_settings" DROP COLUMN "audit_enabled";
  ALTER TABLE "cms"."image_generation_settings" DROP COLUMN "audit_max_attempts";
  ALTER TABLE "cms"."image_generation_settings" DROP COLUMN "audit_failure_action";
  ALTER TABLE "cms"."image_generation_settings" DROP COLUMN "audit_model";
  ALTER TABLE "cms"."image_generation_settings" DROP COLUMN "audit_instructions";
  DROP TYPE "cms"."enum_image_generation_settings_audit_failure_action";
  DROP TYPE "cms"."enum_image_generation_settings_audit_model";`)
}
