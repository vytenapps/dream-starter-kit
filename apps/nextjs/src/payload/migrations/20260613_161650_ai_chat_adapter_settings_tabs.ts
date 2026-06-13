import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "cms"."ext_chat_adapter_sendblue_settings" CASCADE;
  DROP TABLE "cms"."_ext_chat_adapter_sendblue_settings_v" CASCADE;
  DROP TABLE "cms"."ext_chat_adapter_slack_settings" CASCADE;
  DROP TABLE "cms"."_ext_chat_adapter_slack_settings_v" CASCADE;
  ALTER TABLE "cms"."ext_chat_settings" ADD COLUMN "adapter_chat_adapter_sendblue_enabled" boolean DEFAULT true;
  ALTER TABLE "cms"."ext_chat_settings" ADD COLUMN "adapter_chat_adapter_sendblue_daily_outbound_quota" numeric DEFAULT 200;
  ALTER TABLE "cms"."ext_chat_settings" ADD COLUMN "adapter_chat_adapter_slack_enabled" boolean DEFAULT true;
  ALTER TABLE "cms"."_ext_chat_settings_v" ADD COLUMN "version_adapter_chat_adapter_sendblue_enabled" boolean DEFAULT true;
  ALTER TABLE "cms"."_ext_chat_settings_v" ADD COLUMN "version_adapter_chat_adapter_sendblue_daily_outbound_quota" numeric DEFAULT 200;
  ALTER TABLE "cms"."_ext_chat_settings_v" ADD COLUMN "version_adapter_chat_adapter_slack_enabled" boolean DEFAULT true;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "cms"."ext_chat_adapter_sendblue_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"daily_outbound_quota" numeric DEFAULT 200,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "cms"."_ext_chat_adapter_sendblue_settings_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_enabled" boolean DEFAULT true,
  	"version_daily_outbound_quota" numeric DEFAULT 200,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."ext_chat_adapter_slack_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "cms"."_ext_chat_adapter_slack_settings_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_enabled" boolean DEFAULT true,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE INDEX "_ext_chat_adapter_sendblue_settings_v_created_at_idx" ON "cms"."_ext_chat_adapter_sendblue_settings_v" USING btree ("created_at");
  CREATE INDEX "_ext_chat_adapter_sendblue_settings_v_updated_at_idx" ON "cms"."_ext_chat_adapter_sendblue_settings_v" USING btree ("updated_at");
  CREATE INDEX "_ext_chat_adapter_slack_settings_v_created_at_idx" ON "cms"."_ext_chat_adapter_slack_settings_v" USING btree ("created_at");
  CREATE INDEX "_ext_chat_adapter_slack_settings_v_updated_at_idx" ON "cms"."_ext_chat_adapter_slack_settings_v" USING btree ("updated_at");
  ALTER TABLE "cms"."ext_chat_settings" DROP COLUMN "adapter_chat_adapter_sendblue_enabled";
  ALTER TABLE "cms"."ext_chat_settings" DROP COLUMN "adapter_chat_adapter_sendblue_daily_outbound_quota";
  ALTER TABLE "cms"."ext_chat_settings" DROP COLUMN "adapter_chat_adapter_slack_enabled";
  ALTER TABLE "cms"."_ext_chat_settings_v" DROP COLUMN "version_adapter_chat_adapter_sendblue_enabled";
  ALTER TABLE "cms"."_ext_chat_settings_v" DROP COLUMN "version_adapter_chat_adapter_sendblue_daily_outbound_quota";
  ALTER TABLE "cms"."_ext_chat_settings_v" DROP COLUMN "version_adapter_chat_adapter_slack_enabled";`)
}
