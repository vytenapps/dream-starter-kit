// GENERATED copy (`pnpm ext sync`) of extensions/docs/src/payload/migrations/20260613_023123_ext_docs_initial.ts
// so the local `payload migrate` CLI applies it — do not edit.
import { MigrateDownArgs, MigrateUpArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "cms"."enum_ext_docs_pages_source" AS ENUM('manual', 'github');
  CREATE TYPE "cms"."enum_ext_docs_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__ext_docs_pages_v_version_source" AS ENUM('manual', 'github');
  CREATE TYPE "cms"."enum__ext_docs_pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "cms"."ext_docs_pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"excerpt" varchar,
  	"body" jsonb,
  	"category" varchar,
  	"order" numeric DEFAULT 0,
  	"source" "cms"."enum_ext_docs_pages_source" DEFAULT 'manual',
  	"source_path" varchar,
  	"source_sha" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_ext_docs_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."_ext_docs_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_excerpt" varchar,
  	"version_body" jsonb,
  	"version_category" varchar,
  	"version_order" numeric DEFAULT 0,
  	"version_source" "cms"."enum__ext_docs_pages_v_version_source" DEFAULT 'manual',
  	"version_source_path" varchar,
  	"version_source_sha" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__ext_docs_pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."ext_docs_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"github_repo" varchar,
  	"github_branch" varchar DEFAULT 'main',
  	"github_path" varchar DEFAULT 'docs',
  	"sync_now" boolean DEFAULT false,
  	"sync_status" varchar,
  	"sync_error" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "cms"."_ext_docs_settings_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_github_repo" varchar,
  	"version_github_branch" varchar DEFAULT 'main',
  	"version_github_path" varchar DEFAULT 'docs',
  	"version_sync_now" boolean DEFAULT false,
  	"version_sync_status" varchar,
  	"version_sync_error" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN "ext_docs_pages_id" integer;
  ALTER TABLE "cms"."_ext_docs_pages_v" ADD CONSTRAINT "_ext_docs_pages_v_parent_id_ext_docs_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."ext_docs_pages"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "ext_docs_pages_slug_idx" ON "cms"."ext_docs_pages" USING btree ("slug");
  CREATE INDEX "ext_docs_pages_updated_at_idx" ON "cms"."ext_docs_pages" USING btree ("updated_at");
  CREATE INDEX "ext_docs_pages_created_at_idx" ON "cms"."ext_docs_pages" USING btree ("created_at");
  CREATE INDEX "ext_docs_pages__status_idx" ON "cms"."ext_docs_pages" USING btree ("_status");
  CREATE INDEX "_ext_docs_pages_v_parent_idx" ON "cms"."_ext_docs_pages_v" USING btree ("parent_id");
  CREATE INDEX "_ext_docs_pages_v_version_version_slug_idx" ON "cms"."_ext_docs_pages_v" USING btree ("version_slug");
  CREATE INDEX "_ext_docs_pages_v_version_version_updated_at_idx" ON "cms"."_ext_docs_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_ext_docs_pages_v_version_version_created_at_idx" ON "cms"."_ext_docs_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_ext_docs_pages_v_version_version__status_idx" ON "cms"."_ext_docs_pages_v" USING btree ("version__status");
  CREATE INDEX "_ext_docs_pages_v_created_at_idx" ON "cms"."_ext_docs_pages_v" USING btree ("created_at");
  CREATE INDEX "_ext_docs_pages_v_updated_at_idx" ON "cms"."_ext_docs_pages_v" USING btree ("updated_at");
  CREATE INDEX "_ext_docs_pages_v_latest_idx" ON "cms"."_ext_docs_pages_v" USING btree ("latest");
  CREATE INDEX "_ext_docs_settings_v_created_at_idx" ON "cms"."_ext_docs_settings_v" USING btree ("created_at");
  CREATE INDEX "_ext_docs_settings_v_updated_at_idx" ON "cms"."_ext_docs_settings_v" USING btree ("updated_at");
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ext_docs_pages_fk" FOREIGN KEY ("ext_docs_pages_id") REFERENCES "cms"."ext_docs_pages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_ext_docs_pages_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("ext_docs_pages_id");`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cms"."ext_docs_pages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."_ext_docs_pages_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."ext_docs_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."_ext_docs_settings_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "cms"."ext_docs_pages" CASCADE;
  DROP TABLE "cms"."_ext_docs_pages_v" CASCADE;
  DROP TABLE "cms"."ext_docs_settings" CASCADE;
  DROP TABLE "cms"."_ext_docs_settings_v" CASCADE;
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_ext_docs_pages_fk";
  
  DROP INDEX "cms"."payload_locked_documents_rels_ext_docs_pages_id_idx";
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP COLUMN "ext_docs_pages_id";
  DROP TYPE "cms"."enum_ext_docs_pages_source";
  DROP TYPE "cms"."enum_ext_docs_pages_status";
  DROP TYPE "cms"."enum__ext_docs_pages_v_version_source";
  DROP TYPE "cms"."enum__ext_docs_pages_v_version_status";`);
}
