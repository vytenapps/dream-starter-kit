import { MigrateDownArgs, MigrateUpArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "cms"."ext_chat_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"system_prompt" varchar DEFAULT 'You are a concise, friendly assistant inside the Dream app.',
  	"max_history_messages" numeric DEFAULT 20,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "cms"."_ext_chat_settings_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_system_prompt" varchar DEFAULT 'You are a concise, friendly assistant inside the Dream app.',
  	"version_max_history_messages" numeric DEFAULT 20,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE INDEX "_ext_chat_settings_v_created_at_idx" ON "cms"."_ext_chat_settings_v" USING btree ("created_at");
  CREATE INDEX "_ext_chat_settings_v_updated_at_idx" ON "cms"."_ext_chat_settings_v" USING btree ("updated_at");`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "cms"."ext_chat_settings" CASCADE;
  DROP TABLE "cms"."_ext_chat_settings_v" CASCADE;`);
}
