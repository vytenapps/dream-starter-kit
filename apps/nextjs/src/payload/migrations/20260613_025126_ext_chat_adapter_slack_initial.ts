// GENERATED copy (`pnpm ext sync`) of extensions/chat-adapter-slack/src/payload/migrations/20260613_025126_ext_chat_adapter_slack_initial.ts
// so the local `payload migrate` CLI applies it — do not edit.
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Split from a combined migrate:create run so each adapter owns only its own
// settings table (both globals were registered when the diff ran). Slack's
// tables only.
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
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

  CREATE INDEX "_ext_chat_adapter_slack_settings_v_created_at_idx" ON "cms"."_ext_chat_adapter_slack_settings_v" USING btree ("created_at");
  CREATE INDEX "_ext_chat_adapter_slack_settings_v_updated_at_idx" ON "cms"."_ext_chat_adapter_slack_settings_v" USING btree ("updated_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE "cms"."ext_chat_adapter_slack_settings" CASCADE;
  DROP TABLE "cms"."_ext_chat_adapter_slack_settings_v" CASCADE;`)
}
