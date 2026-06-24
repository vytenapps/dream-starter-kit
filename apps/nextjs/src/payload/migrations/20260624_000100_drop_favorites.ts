import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// The CMS `favorites` collection was replaced by the generic, anon-capable
// public.content_favorites RLS table (supabase/migrations/..._anon_identity.sql).
// Drop the cms.favorites + favorites_rels tables and the locked-documents rel
// column. `down` recreates them (mirrors the full_registry definition) so a
// rollback restores the original schema.

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cms"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "favorites_id";
   DROP TABLE IF EXISTS "cms"."favorites_rels" CASCADE;
   DROP TABLE IF EXISTS "cms"."favorites" CASCADE;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "cms"."favorites" (
   	"id" serial PRIMARY KEY NOT NULL,
   	"user_id" integer NOT NULL,
   	"notes" varchar,
   	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
   	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
   );

   CREATE TABLE "cms"."favorites_rels" (
   	"id" serial PRIMARY KEY NOT NULL,
   	"order" integer,
   	"parent_id" integer NOT NULL,
   	"path" varchar NOT NULL,
   	"posts_id" integer,
   	"videos_id" integer,
   	"audio_id" integer,
   	"photos_id" integer,
   	"locations_id" integer,
   	"events_id" integer
   );

   ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN "favorites_id" integer;

   ALTER TABLE "cms"."favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "cms"."favorites_rels" ADD CONSTRAINT "favorites_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."favorites"("id") ON DELETE cascade ON UPDATE no action;
   ALTER TABLE "cms"."favorites_rels" ADD CONSTRAINT "favorites_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "cms"."posts"("id") ON DELETE cascade ON UPDATE no action;
   ALTER TABLE "cms"."favorites_rels" ADD CONSTRAINT "favorites_rels_videos_fk" FOREIGN KEY ("videos_id") REFERENCES "cms"."videos"("id") ON DELETE cascade ON UPDATE no action;
   ALTER TABLE "cms"."favorites_rels" ADD CONSTRAINT "favorites_rels_audio_fk" FOREIGN KEY ("audio_id") REFERENCES "cms"."audio"("id") ON DELETE cascade ON UPDATE no action;
   ALTER TABLE "cms"."favorites_rels" ADD CONSTRAINT "favorites_rels_photos_fk" FOREIGN KEY ("photos_id") REFERENCES "cms"."photos"("id") ON DELETE cascade ON UPDATE no action;
   ALTER TABLE "cms"."favorites_rels" ADD CONSTRAINT "favorites_rels_locations_fk" FOREIGN KEY ("locations_id") REFERENCES "cms"."locations"("id") ON DELETE cascade ON UPDATE no action;
   ALTER TABLE "cms"."favorites_rels" ADD CONSTRAINT "favorites_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "cms"."events"("id") ON DELETE cascade ON UPDATE no action;
   ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_favorites_fk" FOREIGN KEY ("favorites_id") REFERENCES "cms"."favorites"("id") ON DELETE cascade ON UPDATE no action;

   CREATE INDEX "favorites_user_idx" ON "cms"."favorites" USING btree ("user_id");
   CREATE INDEX "favorites_updated_at_idx" ON "cms"."favorites" USING btree ("updated_at");
   CREATE INDEX "favorites_created_at_idx" ON "cms"."favorites" USING btree ("created_at");
   CREATE INDEX "favorites_rels_order_idx" ON "cms"."favorites_rels" USING btree ("order");
   CREATE INDEX "favorites_rels_parent_idx" ON "cms"."favorites_rels" USING btree ("parent_id");
   CREATE INDEX "favorites_rels_path_idx" ON "cms"."favorites_rels" USING btree ("path");
   CREATE INDEX "favorites_rels_posts_id_idx" ON "cms"."favorites_rels" USING btree ("posts_id");
   CREATE INDEX "favorites_rels_videos_id_idx" ON "cms"."favorites_rels" USING btree ("videos_id");
   CREATE INDEX "favorites_rels_audio_id_idx" ON "cms"."favorites_rels" USING btree ("audio_id");
   CREATE INDEX "favorites_rels_photos_id_idx" ON "cms"."favorites_rels" USING btree ("photos_id");
   CREATE INDEX "favorites_rels_locations_id_idx" ON "cms"."favorites_rels" USING btree ("locations_id");
   CREATE INDEX "favorites_rels_events_id_idx" ON "cms"."favorites_rels" USING btree ("events_id");
   CREATE INDEX "payload_locked_documents_rels_favorites_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("favorites_id");`)
}
