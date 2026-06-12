import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "cms"."enum_nav_items_platforms" AS ENUM('web', 'native');
  CREATE TABLE "cms"."kit_extensions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"version" varchar NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"system" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."nav_items_platforms" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum_nav_items_platforms",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."nav_items" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"_order" varchar,
  	"key" varchar NOT NULL,
  	"extension_id" integer,
  	"label" varchar NOT NULL,
  	"href" varchar NOT NULL,
  	"icon" varchar,
  	"enabled" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN "kit_extensions_id" integer;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN "nav_items_id" integer;
  ALTER TABLE "cms"."nav_items_platforms" ADD CONSTRAINT "nav_items_platforms_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."nav_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."nav_items" ADD CONSTRAINT "nav_items_extension_id_kit_extensions_id_fk" FOREIGN KEY ("extension_id") REFERENCES "cms"."kit_extensions"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "kit_extensions_slug_idx" ON "cms"."kit_extensions" USING btree ("slug");
  CREATE INDEX "kit_extensions_updated_at_idx" ON "cms"."kit_extensions" USING btree ("updated_at");
  CREATE INDEX "kit_extensions_created_at_idx" ON "cms"."kit_extensions" USING btree ("created_at");
  CREATE INDEX "nav_items_platforms_order_idx" ON "cms"."nav_items_platforms" USING btree ("order");
  CREATE INDEX "nav_items_platforms_parent_idx" ON "cms"."nav_items_platforms" USING btree ("parent_id");
  CREATE INDEX "nav_items__order_idx" ON "cms"."nav_items" USING btree ("_order");
  CREATE UNIQUE INDEX "nav_items_key_idx" ON "cms"."nav_items" USING btree ("key");
  CREATE INDEX "nav_items_extension_idx" ON "cms"."nav_items" USING btree ("extension_id");
  CREATE INDEX "nav_items_updated_at_idx" ON "cms"."nav_items" USING btree ("updated_at");
  CREATE INDEX "nav_items_created_at_idx" ON "cms"."nav_items" USING btree ("created_at");
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_kit_extensions_fk" FOREIGN KEY ("kit_extensions_id") REFERENCES "cms"."kit_extensions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_nav_items_fk" FOREIGN KEY ("nav_items_id") REFERENCES "cms"."nav_items"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_kit_extensions_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("kit_extensions_id");
  CREATE INDEX "payload_locked_documents_rels_nav_items_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("nav_items_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cms"."kit_extensions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."nav_items_platforms" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."nav_items" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "cms"."kit_extensions" CASCADE;
  DROP TABLE "cms"."nav_items_platforms" CASCADE;
  DROP TABLE "cms"."nav_items" CASCADE;
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_kit_extensions_fk";
  
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_nav_items_fk";
  
  DROP INDEX "cms"."payload_locked_documents_rels_kit_extensions_id_idx";
  DROP INDEX "cms"."payload_locked_documents_rels_nav_items_id_idx";
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP COLUMN "kit_extensions_id";
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP COLUMN "nav_items_id";
  DROP TYPE "cms"."enum_nav_items_platforms";`)
}
