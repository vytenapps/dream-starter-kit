// GENERATED copy (`pnpm ext sync`) of extensions/chat/src/payload/migrations/20260613_021834_ext_chat_skills_and_settings_tabs.ts
// so the local `payload migrate` CLI applies it — do not edit.
import { MigrateDownArgs, MigrateUpArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "cms"."enum_ext_chat_skills_triggers_pattern_type" AS ENUM('keyword', 'synonym', 'regex');
  CREATE TYPE "cms"."enum_ext_chat_settings_channel_prompts_channels" AS ENUM('web', 'native', 'slack', 'sms-sendblue', 'telegram', 'whatsapp', 'discord', 'teams', 'google-chat', 'messenger', 'email', 'twilio-sms', 'github', 'linear');
  CREATE TYPE "cms"."enum_ext_chat_settings_llm_fallback_model" AS ENUM('anthropic/claude-sonnet-4.5', 'anthropic/claude-opus-4.1', 'anthropic/claude-haiku-4.5');
  CREATE TYPE "cms"."enum__ext_chat_settings_v_version_channel_prompts_channels" AS ENUM('web', 'native', 'slack', 'sms-sendblue', 'telegram', 'whatsapp', 'discord', 'teams', 'google-chat', 'messenger', 'email', 'twilio-sms', 'github', 'linear');
  CREATE TYPE "cms"."enum__ext_chat_settings_v_version_llm_fallback_model" AS ENUM('anthropic/claude-sonnet-4.5', 'anthropic/claude-opus-4.1', 'anthropic/claude-haiku-4.5');
  CREATE TABLE "cms"."ext_chat_skills_triggers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"pattern" varchar NOT NULL,
  	"pattern_type" "cms"."enum_ext_chat_skills_triggers_pattern_type" DEFAULT 'keyword' NOT NULL,
  	"weight" numeric DEFAULT 1
  );
  
  CREATE TABLE "cms"."ext_chat_skills" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"is_enabled" boolean DEFAULT true,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"category" varchar,
  	"priority" numeric DEFAULT 100,
  	"persona_prompt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."ext_chat_settings_channel_prompts_channels" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "cms"."enum_ext_chat_settings_channel_prompts_channels",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."ext_chat_settings_channel_prompts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"prompt" varchar NOT NULL
  );
  
  CREATE TABLE "cms"."_ext_chat_settings_v_version_channel_prompts_channels" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum__ext_chat_settings_v_version_channel_prompts_channels",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."_ext_chat_settings_v_version_channel_prompts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"prompt" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN "ext_chat_skills_id" integer;
  ALTER TABLE "cms"."ext_chat_settings" ADD COLUMN "universal_prompt" varchar DEFAULT 'You are a concise, friendly assistant inside the Dream app.';
  ALTER TABLE "cms"."ext_chat_settings" ADD COLUMN "skills_feature_enabled" boolean DEFAULT false;
  ALTER TABLE "cms"."ext_chat_settings" ADD COLUMN "keyword_threshold" numeric DEFAULT 0.6;
  ALTER TABLE "cms"."ext_chat_settings" ADD COLUMN "use_llm_fallback" boolean DEFAULT true;
  ALTER TABLE "cms"."ext_chat_settings" ADD COLUMN "llm_fallback_model" "cms"."enum_ext_chat_settings_llm_fallback_model" DEFAULT 'anthropic/claude-haiku-4.5';
  ALTER TABLE "cms"."ext_chat_settings" ADD COLUMN "stickiness_turns" numeric DEFAULT 2;
  ALTER TABLE "cms"."ext_chat_settings" ADD COLUMN "transcription_enabled" boolean DEFAULT false;
  ALTER TABLE "cms"."ext_chat_settings" ADD COLUMN "transcription_model" varchar DEFAULT 'openai/whisper-1';
  ALTER TABLE "cms"."ext_chat_settings" ADD COLUMN "max_audio_m_b" numeric DEFAULT 25;
  ALTER TABLE "cms"."_ext_chat_settings_v" ADD COLUMN "version_universal_prompt" varchar DEFAULT 'You are a concise, friendly assistant inside the Dream app.';
  ALTER TABLE "cms"."_ext_chat_settings_v" ADD COLUMN "version_skills_feature_enabled" boolean DEFAULT false;
  ALTER TABLE "cms"."_ext_chat_settings_v" ADD COLUMN "version_keyword_threshold" numeric DEFAULT 0.6;
  ALTER TABLE "cms"."_ext_chat_settings_v" ADD COLUMN "version_use_llm_fallback" boolean DEFAULT true;
  ALTER TABLE "cms"."_ext_chat_settings_v" ADD COLUMN "version_llm_fallback_model" "cms"."enum__ext_chat_settings_v_version_llm_fallback_model" DEFAULT 'anthropic/claude-haiku-4.5';
  ALTER TABLE "cms"."_ext_chat_settings_v" ADD COLUMN "version_stickiness_turns" numeric DEFAULT 2;
  ALTER TABLE "cms"."_ext_chat_settings_v" ADD COLUMN "version_transcription_enabled" boolean DEFAULT false;
  ALTER TABLE "cms"."_ext_chat_settings_v" ADD COLUMN "version_transcription_model" varchar DEFAULT 'openai/whisper-1';
  ALTER TABLE "cms"."_ext_chat_settings_v" ADD COLUMN "version_max_audio_m_b" numeric DEFAULT 25;
  ALTER TABLE "cms"."ext_chat_skills_triggers" ADD CONSTRAINT "ext_chat_skills_triggers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."ext_chat_skills"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."ext_chat_settings_channel_prompts_channels" ADD CONSTRAINT "ext_chat_settings_channel_prompts_channels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."ext_chat_settings_channel_prompts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."ext_chat_settings_channel_prompts" ADD CONSTRAINT "ext_chat_settings_channel_prompts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."ext_chat_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_ext_chat_settings_v_version_channel_prompts_channels" ADD CONSTRAINT "_ext_chat_settings_v_version_channel_prompts_channels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_ext_chat_settings_v_version_channel_prompts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_ext_chat_settings_v_version_channel_prompts" ADD CONSTRAINT "_ext_chat_settings_v_version_channel_prompts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_ext_chat_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "ext_chat_skills_triggers_order_idx" ON "cms"."ext_chat_skills_triggers" USING btree ("_order");
  CREATE INDEX "ext_chat_skills_triggers_parent_id_idx" ON "cms"."ext_chat_skills_triggers" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "ext_chat_skills_slug_idx" ON "cms"."ext_chat_skills" USING btree ("slug");
  CREATE INDEX "ext_chat_skills_updated_at_idx" ON "cms"."ext_chat_skills" USING btree ("updated_at");
  CREATE INDEX "ext_chat_skills_created_at_idx" ON "cms"."ext_chat_skills" USING btree ("created_at");
  CREATE INDEX "ext_chat_settings_channel_prompts_channels_order_idx" ON "cms"."ext_chat_settings_channel_prompts_channels" USING btree ("order");
  CREATE INDEX "ext_chat_settings_channel_prompts_channels_parent_idx" ON "cms"."ext_chat_settings_channel_prompts_channels" USING btree ("parent_id");
  CREATE INDEX "ext_chat_settings_channel_prompts_order_idx" ON "cms"."ext_chat_settings_channel_prompts" USING btree ("_order");
  CREATE INDEX "ext_chat_settings_channel_prompts_parent_id_idx" ON "cms"."ext_chat_settings_channel_prompts" USING btree ("_parent_id");
  CREATE INDEX "_ext_chat_settings_v_version_channel_prompts_channels_order_idx" ON "cms"."_ext_chat_settings_v_version_channel_prompts_channels" USING btree ("order");
  CREATE INDEX "_ext_chat_settings_v_version_channel_prompts_channels_parent_idx" ON "cms"."_ext_chat_settings_v_version_channel_prompts_channels" USING btree ("parent_id");
  CREATE INDEX "_ext_chat_settings_v_version_channel_prompts_order_idx" ON "cms"."_ext_chat_settings_v_version_channel_prompts" USING btree ("_order");
  CREATE INDEX "_ext_chat_settings_v_version_channel_prompts_parent_id_idx" ON "cms"."_ext_chat_settings_v_version_channel_prompts" USING btree ("_parent_id");
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ext_chat_skills_fk" FOREIGN KEY ("ext_chat_skills_id") REFERENCES "cms"."ext_chat_skills"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_ext_chat_skills_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("ext_chat_skills_id");
  ALTER TABLE "cms"."ext_chat_settings" DROP COLUMN "system_prompt";
  ALTER TABLE "cms"."_ext_chat_settings_v" DROP COLUMN "version_system_prompt";`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cms"."ext_chat_skills_triggers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."ext_chat_skills" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."ext_chat_settings_channel_prompts_channels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."ext_chat_settings_channel_prompts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."_ext_chat_settings_v_version_channel_prompts_channels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."_ext_chat_settings_v_version_channel_prompts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "cms"."ext_chat_skills_triggers" CASCADE;
  DROP TABLE "cms"."ext_chat_skills" CASCADE;
  DROP TABLE "cms"."ext_chat_settings_channel_prompts_channels" CASCADE;
  DROP TABLE "cms"."ext_chat_settings_channel_prompts" CASCADE;
  DROP TABLE "cms"."_ext_chat_settings_v_version_channel_prompts_channels" CASCADE;
  DROP TABLE "cms"."_ext_chat_settings_v_version_channel_prompts" CASCADE;
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_ext_chat_skills_fk";
  
  DROP INDEX "cms"."payload_locked_documents_rels_ext_chat_skills_id_idx";
  ALTER TABLE "cms"."ext_chat_settings" ADD COLUMN "system_prompt" varchar DEFAULT 'You are a concise, friendly assistant inside the Dream app.';
  ALTER TABLE "cms"."_ext_chat_settings_v" ADD COLUMN "version_system_prompt" varchar DEFAULT 'You are a concise, friendly assistant inside the Dream app.';
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP COLUMN "ext_chat_skills_id";
  ALTER TABLE "cms"."ext_chat_settings" DROP COLUMN "universal_prompt";
  ALTER TABLE "cms"."ext_chat_settings" DROP COLUMN "skills_feature_enabled";
  ALTER TABLE "cms"."ext_chat_settings" DROP COLUMN "keyword_threshold";
  ALTER TABLE "cms"."ext_chat_settings" DROP COLUMN "use_llm_fallback";
  ALTER TABLE "cms"."ext_chat_settings" DROP COLUMN "llm_fallback_model";
  ALTER TABLE "cms"."ext_chat_settings" DROP COLUMN "stickiness_turns";
  ALTER TABLE "cms"."ext_chat_settings" DROP COLUMN "transcription_enabled";
  ALTER TABLE "cms"."ext_chat_settings" DROP COLUMN "transcription_model";
  ALTER TABLE "cms"."ext_chat_settings" DROP COLUMN "max_audio_m_b";
  ALTER TABLE "cms"."_ext_chat_settings_v" DROP COLUMN "version_universal_prompt";
  ALTER TABLE "cms"."_ext_chat_settings_v" DROP COLUMN "version_skills_feature_enabled";
  ALTER TABLE "cms"."_ext_chat_settings_v" DROP COLUMN "version_keyword_threshold";
  ALTER TABLE "cms"."_ext_chat_settings_v" DROP COLUMN "version_use_llm_fallback";
  ALTER TABLE "cms"."_ext_chat_settings_v" DROP COLUMN "version_llm_fallback_model";
  ALTER TABLE "cms"."_ext_chat_settings_v" DROP COLUMN "version_stickiness_turns";
  ALTER TABLE "cms"."_ext_chat_settings_v" DROP COLUMN "version_transcription_enabled";
  ALTER TABLE "cms"."_ext_chat_settings_v" DROP COLUMN "version_transcription_model";
  ALTER TABLE "cms"."_ext_chat_settings_v" DROP COLUMN "version_max_audio_m_b";
  DROP TYPE "cms"."enum_ext_chat_skills_triggers_pattern_type";
  DROP TYPE "cms"."enum_ext_chat_settings_channel_prompts_channels";
  DROP TYPE "cms"."enum_ext_chat_settings_llm_fallback_model";
  DROP TYPE "cms"."enum__ext_chat_settings_v_version_channel_prompts_channels";
  DROP TYPE "cms"."enum__ext_chat_settings_v_version_llm_fallback_model";`);
}
