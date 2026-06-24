import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "cms"."enum_image_generation_settings_model" AS ENUM('google/imagen-4.0-generate-001', 'google/imagen-4.0-fast-generate-001', 'openai/gpt-image-1', 'bfl/flux-pro-1.1');
  CREATE TABLE "cms"."image_generation_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"model" "cms"."enum_image_generation_settings_model" DEFAULT 'google/imagen-4.0-generate-001',
  	"system_prompt" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  ALTER TABLE "cms"."posts" ADD COLUMN "image_prompt" varchar;
  ALTER TABLE "cms"."posts" ADD COLUMN "image_alt" varchar;
  ALTER TABLE "cms"."posts" ADD COLUMN "image_hero_id" integer;
  ALTER TABLE "cms"."posts" ADD COLUMN "image_hero_url" varchar;
  ALTER TABLE "cms"."posts" ADD COLUMN "image_og_id" integer;
  ALTER TABLE "cms"."posts" ADD COLUMN "image_og_url" varchar;
  ALTER TABLE "cms"."_posts_v" ADD COLUMN "version_image_prompt" varchar;
  ALTER TABLE "cms"."_posts_v" ADD COLUMN "version_image_alt" varchar;
  ALTER TABLE "cms"."_posts_v" ADD COLUMN "version_image_hero_id" integer;
  ALTER TABLE "cms"."_posts_v" ADD COLUMN "version_image_hero_url" varchar;
  ALTER TABLE "cms"."_posts_v" ADD COLUMN "version_image_og_id" integer;
  ALTER TABLE "cms"."_posts_v" ADD COLUMN "version_image_og_url" varchar;
  ALTER TABLE "cms"."videos" ADD COLUMN "image_prompt" varchar;
  ALTER TABLE "cms"."videos" ADD COLUMN "image_alt" varchar;
  ALTER TABLE "cms"."videos" ADD COLUMN "image_hero_id" integer;
  ALTER TABLE "cms"."videos" ADD COLUMN "image_hero_url" varchar;
  ALTER TABLE "cms"."videos" ADD COLUMN "image_og_id" integer;
  ALTER TABLE "cms"."videos" ADD COLUMN "image_og_url" varchar;
  ALTER TABLE "cms"."_videos_v" ADD COLUMN "version_image_prompt" varchar;
  ALTER TABLE "cms"."_videos_v" ADD COLUMN "version_image_alt" varchar;
  ALTER TABLE "cms"."_videos_v" ADD COLUMN "version_image_hero_id" integer;
  ALTER TABLE "cms"."_videos_v" ADD COLUMN "version_image_hero_url" varchar;
  ALTER TABLE "cms"."_videos_v" ADD COLUMN "version_image_og_id" integer;
  ALTER TABLE "cms"."_videos_v" ADD COLUMN "version_image_og_url" varchar;
  ALTER TABLE "cms"."audio" ADD COLUMN "image_prompt" varchar;
  ALTER TABLE "cms"."audio" ADD COLUMN "image_alt" varchar;
  ALTER TABLE "cms"."audio" ADD COLUMN "image_hero_id" integer;
  ALTER TABLE "cms"."audio" ADD COLUMN "image_hero_url" varchar;
  ALTER TABLE "cms"."audio" ADD COLUMN "image_og_id" integer;
  ALTER TABLE "cms"."audio" ADD COLUMN "image_og_url" varchar;
  ALTER TABLE "cms"."series" ADD COLUMN "image_prompt" varchar;
  ALTER TABLE "cms"."series" ADD COLUMN "image_alt" varchar;
  ALTER TABLE "cms"."series" ADD COLUMN "image_hero_id" integer;
  ALTER TABLE "cms"."series" ADD COLUMN "image_hero_url" varchar;
  ALTER TABLE "cms"."series" ADD COLUMN "image_og_id" integer;
  ALTER TABLE "cms"."series" ADD COLUMN "image_og_url" varchar;
  ALTER TABLE "cms"."series" ADD COLUMN "image_square_id" integer;
  ALTER TABLE "cms"."series" ADD COLUMN "image_square_url" varchar;
  ALTER TABLE "cms"."_series_v" ADD COLUMN "version_image_prompt" varchar;
  ALTER TABLE "cms"."_series_v" ADD COLUMN "version_image_alt" varchar;
  ALTER TABLE "cms"."_series_v" ADD COLUMN "version_image_hero_id" integer;
  ALTER TABLE "cms"."_series_v" ADD COLUMN "version_image_hero_url" varchar;
  ALTER TABLE "cms"."_series_v" ADD COLUMN "version_image_og_id" integer;
  ALTER TABLE "cms"."_series_v" ADD COLUMN "version_image_og_url" varchar;
  ALTER TABLE "cms"."_series_v" ADD COLUMN "version_image_square_id" integer;
  ALTER TABLE "cms"."_series_v" ADD COLUMN "version_image_square_url" varchar;
  ALTER TABLE "cms"."locations" ADD COLUMN "image_prompt" varchar;
  ALTER TABLE "cms"."locations" ADD COLUMN "image_alt" varchar;
  ALTER TABLE "cms"."locations" ADD COLUMN "image_hero_id" integer;
  ALTER TABLE "cms"."locations" ADD COLUMN "image_hero_url" varchar;
  ALTER TABLE "cms"."locations" ADD COLUMN "image_og_id" integer;
  ALTER TABLE "cms"."locations" ADD COLUMN "image_og_url" varchar;
  ALTER TABLE "cms"."locations" ADD COLUMN "image_square_id" integer;
  ALTER TABLE "cms"."locations" ADD COLUMN "image_square_url" varchar;
  ALTER TABLE "cms"."_locations_v" ADD COLUMN "version_image_prompt" varchar;
  ALTER TABLE "cms"."_locations_v" ADD COLUMN "version_image_alt" varchar;
  ALTER TABLE "cms"."_locations_v" ADD COLUMN "version_image_hero_id" integer;
  ALTER TABLE "cms"."_locations_v" ADD COLUMN "version_image_hero_url" varchar;
  ALTER TABLE "cms"."_locations_v" ADD COLUMN "version_image_og_id" integer;
  ALTER TABLE "cms"."_locations_v" ADD COLUMN "version_image_og_url" varchar;
  ALTER TABLE "cms"."_locations_v" ADD COLUMN "version_image_square_id" integer;
  ALTER TABLE "cms"."_locations_v" ADD COLUMN "version_image_square_url" varchar;
  ALTER TABLE "cms"."events" ADD COLUMN "image_prompt" varchar;
  ALTER TABLE "cms"."events" ADD COLUMN "image_alt" varchar;
  ALTER TABLE "cms"."events" ADD COLUMN "image_hero_id" integer;
  ALTER TABLE "cms"."events" ADD COLUMN "image_hero_url" varchar;
  ALTER TABLE "cms"."events" ADD COLUMN "image_og_id" integer;
  ALTER TABLE "cms"."events" ADD COLUMN "image_og_url" varchar;
  ALTER TABLE "cms"."events" ADD COLUMN "image_square_id" integer;
  ALTER TABLE "cms"."events" ADD COLUMN "image_square_url" varchar;
  ALTER TABLE "cms"."_events_v" ADD COLUMN "version_image_prompt" varchar;
  ALTER TABLE "cms"."_events_v" ADD COLUMN "version_image_alt" varchar;
  ALTER TABLE "cms"."_events_v" ADD COLUMN "version_image_hero_id" integer;
  ALTER TABLE "cms"."_events_v" ADD COLUMN "version_image_hero_url" varchar;
  ALTER TABLE "cms"."_events_v" ADD COLUMN "version_image_og_id" integer;
  ALTER TABLE "cms"."_events_v" ADD COLUMN "version_image_og_url" varchar;
  ALTER TABLE "cms"."_events_v" ADD COLUMN "version_image_square_id" integer;
  ALTER TABLE "cms"."_events_v" ADD COLUMN "version_image_square_url" varchar;
  ALTER TABLE "cms"."pages" ADD COLUMN "image_prompt" varchar;
  ALTER TABLE "cms"."pages" ADD COLUMN "image_alt" varchar;
  ALTER TABLE "cms"."pages" ADD COLUMN "image_hero_id" integer;
  ALTER TABLE "cms"."pages" ADD COLUMN "image_hero_url" varchar;
  ALTER TABLE "cms"."pages" ADD COLUMN "image_og_id" integer;
  ALTER TABLE "cms"."pages" ADD COLUMN "image_og_url" varchar;
  ALTER TABLE "cms"."_pages_v" ADD COLUMN "version_image_prompt" varchar;
  ALTER TABLE "cms"."_pages_v" ADD COLUMN "version_image_alt" varchar;
  ALTER TABLE "cms"."_pages_v" ADD COLUMN "version_image_hero_id" integer;
  ALTER TABLE "cms"."_pages_v" ADD COLUMN "version_image_hero_url" varchar;
  ALTER TABLE "cms"."_pages_v" ADD COLUMN "version_image_og_id" integer;
  ALTER TABLE "cms"."_pages_v" ADD COLUMN "version_image_og_url" varchar;
  ALTER TABLE "cms"."posts" ADD CONSTRAINT "posts_image_hero_id_media_id_fk" FOREIGN KEY ("image_hero_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."posts" ADD CONSTRAINT "posts_image_og_id_media_id_fk" FOREIGN KEY ("image_og_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v" ADD CONSTRAINT "_posts_v_version_image_hero_id_media_id_fk" FOREIGN KEY ("version_image_hero_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v" ADD CONSTRAINT "_posts_v_version_image_og_id_media_id_fk" FOREIGN KEY ("version_image_og_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."videos" ADD CONSTRAINT "videos_image_hero_id_media_id_fk" FOREIGN KEY ("image_hero_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."videos" ADD CONSTRAINT "videos_image_og_id_media_id_fk" FOREIGN KEY ("image_og_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_videos_v" ADD CONSTRAINT "_videos_v_version_image_hero_id_media_id_fk" FOREIGN KEY ("version_image_hero_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_videos_v" ADD CONSTRAINT "_videos_v_version_image_og_id_media_id_fk" FOREIGN KEY ("version_image_og_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."audio" ADD CONSTRAINT "audio_image_hero_id_media_id_fk" FOREIGN KEY ("image_hero_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."audio" ADD CONSTRAINT "audio_image_og_id_media_id_fk" FOREIGN KEY ("image_og_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."series" ADD CONSTRAINT "series_image_hero_id_media_id_fk" FOREIGN KEY ("image_hero_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."series" ADD CONSTRAINT "series_image_og_id_media_id_fk" FOREIGN KEY ("image_og_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."series" ADD CONSTRAINT "series_image_square_id_media_id_fk" FOREIGN KEY ("image_square_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_series_v" ADD CONSTRAINT "_series_v_version_image_hero_id_media_id_fk" FOREIGN KEY ("version_image_hero_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_series_v" ADD CONSTRAINT "_series_v_version_image_og_id_media_id_fk" FOREIGN KEY ("version_image_og_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_series_v" ADD CONSTRAINT "_series_v_version_image_square_id_media_id_fk" FOREIGN KEY ("version_image_square_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."locations" ADD CONSTRAINT "locations_image_hero_id_media_id_fk" FOREIGN KEY ("image_hero_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."locations" ADD CONSTRAINT "locations_image_og_id_media_id_fk" FOREIGN KEY ("image_og_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."locations" ADD CONSTRAINT "locations_image_square_id_media_id_fk" FOREIGN KEY ("image_square_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_locations_v" ADD CONSTRAINT "_locations_v_version_image_hero_id_media_id_fk" FOREIGN KEY ("version_image_hero_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_locations_v" ADD CONSTRAINT "_locations_v_version_image_og_id_media_id_fk" FOREIGN KEY ("version_image_og_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_locations_v" ADD CONSTRAINT "_locations_v_version_image_square_id_media_id_fk" FOREIGN KEY ("version_image_square_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."events" ADD CONSTRAINT "events_image_hero_id_media_id_fk" FOREIGN KEY ("image_hero_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."events" ADD CONSTRAINT "events_image_og_id_media_id_fk" FOREIGN KEY ("image_og_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."events" ADD CONSTRAINT "events_image_square_id_media_id_fk" FOREIGN KEY ("image_square_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_events_v" ADD CONSTRAINT "_events_v_version_image_hero_id_media_id_fk" FOREIGN KEY ("version_image_hero_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_events_v" ADD CONSTRAINT "_events_v_version_image_og_id_media_id_fk" FOREIGN KEY ("version_image_og_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_events_v" ADD CONSTRAINT "_events_v_version_image_square_id_media_id_fk" FOREIGN KEY ("version_image_square_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."pages" ADD CONSTRAINT "pages_image_hero_id_media_id_fk" FOREIGN KEY ("image_hero_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."pages" ADD CONSTRAINT "pages_image_og_id_media_id_fk" FOREIGN KEY ("image_og_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v" ADD CONSTRAINT "_pages_v_version_image_hero_id_media_id_fk" FOREIGN KEY ("version_image_hero_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v" ADD CONSTRAINT "_pages_v_version_image_og_id_media_id_fk" FOREIGN KEY ("version_image_og_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "posts_image_hero_idx" ON "cms"."posts" USING btree ("image_hero_id");
  CREATE INDEX "posts_image_og_idx" ON "cms"."posts" USING btree ("image_og_id");
  CREATE INDEX "_posts_v_version_version_image_hero_idx" ON "cms"."_posts_v" USING btree ("version_image_hero_id");
  CREATE INDEX "_posts_v_version_version_image_og_idx" ON "cms"."_posts_v" USING btree ("version_image_og_id");
  CREATE INDEX "videos_image_hero_idx" ON "cms"."videos" USING btree ("image_hero_id");
  CREATE INDEX "videos_image_og_idx" ON "cms"."videos" USING btree ("image_og_id");
  CREATE INDEX "_videos_v_version_version_image_hero_idx" ON "cms"."_videos_v" USING btree ("version_image_hero_id");
  CREATE INDEX "_videos_v_version_version_image_og_idx" ON "cms"."_videos_v" USING btree ("version_image_og_id");
  CREATE INDEX "audio_image_hero_idx" ON "cms"."audio" USING btree ("image_hero_id");
  CREATE INDEX "audio_image_og_idx" ON "cms"."audio" USING btree ("image_og_id");
  CREATE INDEX "series_image_hero_idx" ON "cms"."series" USING btree ("image_hero_id");
  CREATE INDEX "series_image_og_idx" ON "cms"."series" USING btree ("image_og_id");
  CREATE INDEX "series_image_square_idx" ON "cms"."series" USING btree ("image_square_id");
  CREATE INDEX "_series_v_version_version_image_hero_idx" ON "cms"."_series_v" USING btree ("version_image_hero_id");
  CREATE INDEX "_series_v_version_version_image_og_idx" ON "cms"."_series_v" USING btree ("version_image_og_id");
  CREATE INDEX "_series_v_version_version_image_square_idx" ON "cms"."_series_v" USING btree ("version_image_square_id");
  CREATE INDEX "locations_image_hero_idx" ON "cms"."locations" USING btree ("image_hero_id");
  CREATE INDEX "locations_image_og_idx" ON "cms"."locations" USING btree ("image_og_id");
  CREATE INDEX "locations_image_square_idx" ON "cms"."locations" USING btree ("image_square_id");
  CREATE INDEX "_locations_v_version_version_image_hero_idx" ON "cms"."_locations_v" USING btree ("version_image_hero_id");
  CREATE INDEX "_locations_v_version_version_image_og_idx" ON "cms"."_locations_v" USING btree ("version_image_og_id");
  CREATE INDEX "_locations_v_version_version_image_square_idx" ON "cms"."_locations_v" USING btree ("version_image_square_id");
  CREATE INDEX "events_image_hero_idx" ON "cms"."events" USING btree ("image_hero_id");
  CREATE INDEX "events_image_og_idx" ON "cms"."events" USING btree ("image_og_id");
  CREATE INDEX "events_image_square_idx" ON "cms"."events" USING btree ("image_square_id");
  CREATE INDEX "_events_v_version_version_image_hero_idx" ON "cms"."_events_v" USING btree ("version_image_hero_id");
  CREATE INDEX "_events_v_version_version_image_og_idx" ON "cms"."_events_v" USING btree ("version_image_og_id");
  CREATE INDEX "_events_v_version_version_image_square_idx" ON "cms"."_events_v" USING btree ("version_image_square_id");
  CREATE INDEX "pages_image_hero_idx" ON "cms"."pages" USING btree ("image_hero_id");
  CREATE INDEX "pages_image_og_idx" ON "cms"."pages" USING btree ("image_og_id");
  CREATE INDEX "_pages_v_version_version_image_hero_idx" ON "cms"."_pages_v" USING btree ("version_image_hero_id");
  CREATE INDEX "_pages_v_version_version_image_og_idx" ON "cms"."_pages_v" USING btree ("version_image_og_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cms"."image_generation_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "cms"."image_generation_settings" CASCADE;
  ALTER TABLE "cms"."posts" DROP CONSTRAINT "posts_image_hero_id_media_id_fk";
  
  ALTER TABLE "cms"."posts" DROP CONSTRAINT "posts_image_og_id_media_id_fk";
  
  ALTER TABLE "cms"."_posts_v" DROP CONSTRAINT "_posts_v_version_image_hero_id_media_id_fk";
  
  ALTER TABLE "cms"."_posts_v" DROP CONSTRAINT "_posts_v_version_image_og_id_media_id_fk";
  
  ALTER TABLE "cms"."videos" DROP CONSTRAINT "videos_image_hero_id_media_id_fk";
  
  ALTER TABLE "cms"."videos" DROP CONSTRAINT "videos_image_og_id_media_id_fk";
  
  ALTER TABLE "cms"."_videos_v" DROP CONSTRAINT "_videos_v_version_image_hero_id_media_id_fk";
  
  ALTER TABLE "cms"."_videos_v" DROP CONSTRAINT "_videos_v_version_image_og_id_media_id_fk";
  
  ALTER TABLE "cms"."audio" DROP CONSTRAINT "audio_image_hero_id_media_id_fk";
  
  ALTER TABLE "cms"."audio" DROP CONSTRAINT "audio_image_og_id_media_id_fk";
  
  ALTER TABLE "cms"."series" DROP CONSTRAINT "series_image_hero_id_media_id_fk";
  
  ALTER TABLE "cms"."series" DROP CONSTRAINT "series_image_og_id_media_id_fk";
  
  ALTER TABLE "cms"."series" DROP CONSTRAINT "series_image_square_id_media_id_fk";
  
  ALTER TABLE "cms"."_series_v" DROP CONSTRAINT "_series_v_version_image_hero_id_media_id_fk";
  
  ALTER TABLE "cms"."_series_v" DROP CONSTRAINT "_series_v_version_image_og_id_media_id_fk";
  
  ALTER TABLE "cms"."_series_v" DROP CONSTRAINT "_series_v_version_image_square_id_media_id_fk";
  
  ALTER TABLE "cms"."locations" DROP CONSTRAINT "locations_image_hero_id_media_id_fk";
  
  ALTER TABLE "cms"."locations" DROP CONSTRAINT "locations_image_og_id_media_id_fk";
  
  ALTER TABLE "cms"."locations" DROP CONSTRAINT "locations_image_square_id_media_id_fk";
  
  ALTER TABLE "cms"."_locations_v" DROP CONSTRAINT "_locations_v_version_image_hero_id_media_id_fk";
  
  ALTER TABLE "cms"."_locations_v" DROP CONSTRAINT "_locations_v_version_image_og_id_media_id_fk";
  
  ALTER TABLE "cms"."_locations_v" DROP CONSTRAINT "_locations_v_version_image_square_id_media_id_fk";
  
  ALTER TABLE "cms"."events" DROP CONSTRAINT "events_image_hero_id_media_id_fk";
  
  ALTER TABLE "cms"."events" DROP CONSTRAINT "events_image_og_id_media_id_fk";
  
  ALTER TABLE "cms"."events" DROP CONSTRAINT "events_image_square_id_media_id_fk";
  
  ALTER TABLE "cms"."_events_v" DROP CONSTRAINT "_events_v_version_image_hero_id_media_id_fk";
  
  ALTER TABLE "cms"."_events_v" DROP CONSTRAINT "_events_v_version_image_og_id_media_id_fk";
  
  ALTER TABLE "cms"."_events_v" DROP CONSTRAINT "_events_v_version_image_square_id_media_id_fk";
  
  ALTER TABLE "cms"."pages" DROP CONSTRAINT "pages_image_hero_id_media_id_fk";
  
  ALTER TABLE "cms"."pages" DROP CONSTRAINT "pages_image_og_id_media_id_fk";
  
  ALTER TABLE "cms"."_pages_v" DROP CONSTRAINT "_pages_v_version_image_hero_id_media_id_fk";
  
  ALTER TABLE "cms"."_pages_v" DROP CONSTRAINT "_pages_v_version_image_og_id_media_id_fk";
  
  DROP INDEX "cms"."posts_image_hero_idx";
  DROP INDEX "cms"."posts_image_og_idx";
  DROP INDEX "cms"."_posts_v_version_version_image_hero_idx";
  DROP INDEX "cms"."_posts_v_version_version_image_og_idx";
  DROP INDEX "cms"."videos_image_hero_idx";
  DROP INDEX "cms"."videos_image_og_idx";
  DROP INDEX "cms"."_videos_v_version_version_image_hero_idx";
  DROP INDEX "cms"."_videos_v_version_version_image_og_idx";
  DROP INDEX "cms"."audio_image_hero_idx";
  DROP INDEX "cms"."audio_image_og_idx";
  DROP INDEX "cms"."series_image_hero_idx";
  DROP INDEX "cms"."series_image_og_idx";
  DROP INDEX "cms"."series_image_square_idx";
  DROP INDEX "cms"."_series_v_version_version_image_hero_idx";
  DROP INDEX "cms"."_series_v_version_version_image_og_idx";
  DROP INDEX "cms"."_series_v_version_version_image_square_idx";
  DROP INDEX "cms"."locations_image_hero_idx";
  DROP INDEX "cms"."locations_image_og_idx";
  DROP INDEX "cms"."locations_image_square_idx";
  DROP INDEX "cms"."_locations_v_version_version_image_hero_idx";
  DROP INDEX "cms"."_locations_v_version_version_image_og_idx";
  DROP INDEX "cms"."_locations_v_version_version_image_square_idx";
  DROP INDEX "cms"."events_image_hero_idx";
  DROP INDEX "cms"."events_image_og_idx";
  DROP INDEX "cms"."events_image_square_idx";
  DROP INDEX "cms"."_events_v_version_version_image_hero_idx";
  DROP INDEX "cms"."_events_v_version_version_image_og_idx";
  DROP INDEX "cms"."_events_v_version_version_image_square_idx";
  DROP INDEX "cms"."pages_image_hero_idx";
  DROP INDEX "cms"."pages_image_og_idx";
  DROP INDEX "cms"."_pages_v_version_version_image_hero_idx";
  DROP INDEX "cms"."_pages_v_version_version_image_og_idx";
  ALTER TABLE "cms"."posts" DROP COLUMN "image_prompt";
  ALTER TABLE "cms"."posts" DROP COLUMN "image_alt";
  ALTER TABLE "cms"."posts" DROP COLUMN "image_hero_id";
  ALTER TABLE "cms"."posts" DROP COLUMN "image_hero_url";
  ALTER TABLE "cms"."posts" DROP COLUMN "image_og_id";
  ALTER TABLE "cms"."posts" DROP COLUMN "image_og_url";
  ALTER TABLE "cms"."_posts_v" DROP COLUMN "version_image_prompt";
  ALTER TABLE "cms"."_posts_v" DROP COLUMN "version_image_alt";
  ALTER TABLE "cms"."_posts_v" DROP COLUMN "version_image_hero_id";
  ALTER TABLE "cms"."_posts_v" DROP COLUMN "version_image_hero_url";
  ALTER TABLE "cms"."_posts_v" DROP COLUMN "version_image_og_id";
  ALTER TABLE "cms"."_posts_v" DROP COLUMN "version_image_og_url";
  ALTER TABLE "cms"."videos" DROP COLUMN "image_prompt";
  ALTER TABLE "cms"."videos" DROP COLUMN "image_alt";
  ALTER TABLE "cms"."videos" DROP COLUMN "image_hero_id";
  ALTER TABLE "cms"."videos" DROP COLUMN "image_hero_url";
  ALTER TABLE "cms"."videos" DROP COLUMN "image_og_id";
  ALTER TABLE "cms"."videos" DROP COLUMN "image_og_url";
  ALTER TABLE "cms"."_videos_v" DROP COLUMN "version_image_prompt";
  ALTER TABLE "cms"."_videos_v" DROP COLUMN "version_image_alt";
  ALTER TABLE "cms"."_videos_v" DROP COLUMN "version_image_hero_id";
  ALTER TABLE "cms"."_videos_v" DROP COLUMN "version_image_hero_url";
  ALTER TABLE "cms"."_videos_v" DROP COLUMN "version_image_og_id";
  ALTER TABLE "cms"."_videos_v" DROP COLUMN "version_image_og_url";
  ALTER TABLE "cms"."audio" DROP COLUMN "image_prompt";
  ALTER TABLE "cms"."audio" DROP COLUMN "image_alt";
  ALTER TABLE "cms"."audio" DROP COLUMN "image_hero_id";
  ALTER TABLE "cms"."audio" DROP COLUMN "image_hero_url";
  ALTER TABLE "cms"."audio" DROP COLUMN "image_og_id";
  ALTER TABLE "cms"."audio" DROP COLUMN "image_og_url";
  ALTER TABLE "cms"."series" DROP COLUMN "image_prompt";
  ALTER TABLE "cms"."series" DROP COLUMN "image_alt";
  ALTER TABLE "cms"."series" DROP COLUMN "image_hero_id";
  ALTER TABLE "cms"."series" DROP COLUMN "image_hero_url";
  ALTER TABLE "cms"."series" DROP COLUMN "image_og_id";
  ALTER TABLE "cms"."series" DROP COLUMN "image_og_url";
  ALTER TABLE "cms"."series" DROP COLUMN "image_square_id";
  ALTER TABLE "cms"."series" DROP COLUMN "image_square_url";
  ALTER TABLE "cms"."_series_v" DROP COLUMN "version_image_prompt";
  ALTER TABLE "cms"."_series_v" DROP COLUMN "version_image_alt";
  ALTER TABLE "cms"."_series_v" DROP COLUMN "version_image_hero_id";
  ALTER TABLE "cms"."_series_v" DROP COLUMN "version_image_hero_url";
  ALTER TABLE "cms"."_series_v" DROP COLUMN "version_image_og_id";
  ALTER TABLE "cms"."_series_v" DROP COLUMN "version_image_og_url";
  ALTER TABLE "cms"."_series_v" DROP COLUMN "version_image_square_id";
  ALTER TABLE "cms"."_series_v" DROP COLUMN "version_image_square_url";
  ALTER TABLE "cms"."locations" DROP COLUMN "image_prompt";
  ALTER TABLE "cms"."locations" DROP COLUMN "image_alt";
  ALTER TABLE "cms"."locations" DROP COLUMN "image_hero_id";
  ALTER TABLE "cms"."locations" DROP COLUMN "image_hero_url";
  ALTER TABLE "cms"."locations" DROP COLUMN "image_og_id";
  ALTER TABLE "cms"."locations" DROP COLUMN "image_og_url";
  ALTER TABLE "cms"."locations" DROP COLUMN "image_square_id";
  ALTER TABLE "cms"."locations" DROP COLUMN "image_square_url";
  ALTER TABLE "cms"."_locations_v" DROP COLUMN "version_image_prompt";
  ALTER TABLE "cms"."_locations_v" DROP COLUMN "version_image_alt";
  ALTER TABLE "cms"."_locations_v" DROP COLUMN "version_image_hero_id";
  ALTER TABLE "cms"."_locations_v" DROP COLUMN "version_image_hero_url";
  ALTER TABLE "cms"."_locations_v" DROP COLUMN "version_image_og_id";
  ALTER TABLE "cms"."_locations_v" DROP COLUMN "version_image_og_url";
  ALTER TABLE "cms"."_locations_v" DROP COLUMN "version_image_square_id";
  ALTER TABLE "cms"."_locations_v" DROP COLUMN "version_image_square_url";
  ALTER TABLE "cms"."events" DROP COLUMN "image_prompt";
  ALTER TABLE "cms"."events" DROP COLUMN "image_alt";
  ALTER TABLE "cms"."events" DROP COLUMN "image_hero_id";
  ALTER TABLE "cms"."events" DROP COLUMN "image_hero_url";
  ALTER TABLE "cms"."events" DROP COLUMN "image_og_id";
  ALTER TABLE "cms"."events" DROP COLUMN "image_og_url";
  ALTER TABLE "cms"."events" DROP COLUMN "image_square_id";
  ALTER TABLE "cms"."events" DROP COLUMN "image_square_url";
  ALTER TABLE "cms"."_events_v" DROP COLUMN "version_image_prompt";
  ALTER TABLE "cms"."_events_v" DROP COLUMN "version_image_alt";
  ALTER TABLE "cms"."_events_v" DROP COLUMN "version_image_hero_id";
  ALTER TABLE "cms"."_events_v" DROP COLUMN "version_image_hero_url";
  ALTER TABLE "cms"."_events_v" DROP COLUMN "version_image_og_id";
  ALTER TABLE "cms"."_events_v" DROP COLUMN "version_image_og_url";
  ALTER TABLE "cms"."_events_v" DROP COLUMN "version_image_square_id";
  ALTER TABLE "cms"."_events_v" DROP COLUMN "version_image_square_url";
  ALTER TABLE "cms"."pages" DROP COLUMN "image_prompt";
  ALTER TABLE "cms"."pages" DROP COLUMN "image_alt";
  ALTER TABLE "cms"."pages" DROP COLUMN "image_hero_id";
  ALTER TABLE "cms"."pages" DROP COLUMN "image_hero_url";
  ALTER TABLE "cms"."pages" DROP COLUMN "image_og_id";
  ALTER TABLE "cms"."pages" DROP COLUMN "image_og_url";
  ALTER TABLE "cms"."_pages_v" DROP COLUMN "version_image_prompt";
  ALTER TABLE "cms"."_pages_v" DROP COLUMN "version_image_alt";
  ALTER TABLE "cms"."_pages_v" DROP COLUMN "version_image_hero_id";
  ALTER TABLE "cms"."_pages_v" DROP COLUMN "version_image_hero_url";
  ALTER TABLE "cms"."_pages_v" DROP COLUMN "version_image_og_id";
  ALTER TABLE "cms"."_pages_v" DROP COLUMN "version_image_og_url";
  DROP TYPE "cms"."enum_image_generation_settings_model";`)
}
