import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "cms"."enum_users_role" AS ENUM('admin', 'editor');
  CREATE TYPE "cms"."enum_articles_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__articles_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_events_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__events_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_videos_source_type" AS ENUM('url', 'upload');
  CREATE TYPE "cms"."enum_videos_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__videos_v_version_source_type" AS ENUM('url', 'upload');
  CREATE TYPE "cms"."enum__videos_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_audio_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__audio_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_photos_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__photos_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_locations_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__locations_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_pages_blocks_hero_buttons_variant" AS ENUM('default', 'glow', 'outline', 'secondary');
  CREATE TYPE "cms"."enum_pages_blocks_items_items_icon" AS ENUM('Rocket', 'Zap', 'ShieldCheck', 'Sparkles', 'Star', 'Heart', 'Globe', 'Code', 'Layers', 'Smartphone', 'Palette', 'Lock', 'Check', 'Cloud', 'Bell', 'Settings', 'Users', 'ChartBar', 'Search', 'Mail');
  CREATE TYPE "cms"."enum_pages_blocks_cta_buttons_variant" AS ENUM('default', 'glow', 'outline', 'secondary');
  CREATE TYPE "cms"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__pages_v_blocks_hero_buttons_variant" AS ENUM('default', 'glow', 'outline', 'secondary');
  CREATE TYPE "cms"."enum__pages_v_blocks_items_items_icon" AS ENUM('Rocket', 'Zap', 'ShieldCheck', 'Sparkles', 'Star', 'Heart', 'Globe', 'Code', 'Layers', 'Smartphone', 'Palette', 'Lock', 'Check', 'Cloud', 'Bell', 'Settings', 'Users', 'ChartBar', 'Search', 'Mail');
  CREATE TYPE "cms"."enum__pages_v_blocks_cta_buttons_variant" AS ENUM('default', 'glow', 'outline', 'secondary');
  CREATE TYPE "cms"."enum__pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_site_settings_header_actions_variant" AS ENUM('default', 'glow', 'outline', 'secondary');
  CREATE TYPE "cms"."enum_theme_settings_font_sans" AS ENUM('geist', 'inter', 'system');
  CREATE TYPE "cms"."enum_theme_settings_font_serif" AS ENUM('merriweather', 'lora', 'system');
  CREATE TYPE "cms"."enum_theme_settings_font_mono" AS ENUM('geist-mono', 'jetbrains-mono');
  CREATE TYPE "cms"."enum_theme_settings_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__theme_settings_v_version_font_sans" AS ENUM('geist', 'inter', 'system');
  CREATE TYPE "cms"."enum__theme_settings_v_version_font_serif" AS ENUM('merriweather', 'lora', 'system');
  CREATE TYPE "cms"."enum__theme_settings_v_version_font_mono" AS ENUM('geist-mono', 'jetbrains-mono');
  CREATE TYPE "cms"."enum__theme_settings_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "cms"."users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar,
  	"name" varchar,
  	"supabase_user_id" varchar,
  	"role" "cms"."enum_users_role" DEFAULT 'editor' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"caption" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_hero_url" varchar,
  	"sizes_hero_width" numeric,
  	"sizes_hero_height" numeric,
  	"sizes_hero_mime_type" varchar,
  	"sizes_hero_filesize" numeric,
  	"sizes_hero_filename" varchar
  );
  
  CREATE TABLE "cms"."articles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"excerpt" varchar,
  	"hero_image_id" integer,
  	"body" jsonb,
  	"author_id" integer,
  	"published_at" timestamp(3) with time zone,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_articles_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."articles_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "cms"."_articles_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_excerpt" varchar,
  	"version_hero_image_id" integer,
  	"version_body" jsonb,
  	"version_author_id" integer,
  	"version_published_at" timestamp(3) with time zone,
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_meta_image_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__articles_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."_articles_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "cms"."events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"description" jsonb,
  	"starts_at" timestamp(3) with time zone,
  	"ends_at" timestamp(3) with time zone,
  	"location_id" integer,
  	"image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_events_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."_events_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_description" jsonb,
  	"version_starts_at" timestamp(3) with time zone,
  	"version_ends_at" timestamp(3) with time zone,
  	"version_location_id" integer,
  	"version_image_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__events_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."videos" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"description" varchar,
  	"source_type" "cms"."enum_videos_source_type" DEFAULT 'url',
  	"url" varchar,
  	"file_id" integer,
  	"thumbnail_id" integer,
  	"duration" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_videos_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."_videos_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_description" varchar,
  	"version_source_type" "cms"."enum__videos_v_version_source_type" DEFAULT 'url',
  	"version_url" varchar,
  	"version_file_id" integer,
  	"version_thumbnail_id" integer,
  	"version_duration" numeric,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__videos_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."audio" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"description" varchar,
  	"audio_file_id" integer,
  	"duration" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_audio_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."_audio_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_description" varchar,
  	"version_audio_file_id" integer,
  	"version_duration" numeric,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__audio_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."photos_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar
  );
  
  CREATE TABLE "cms"."photos" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"image_id" integer,
  	"caption" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_photos_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."_photos_v_version_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "cms"."_photos_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_image_id" integer,
  	"version_caption" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__photos_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."locations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"slug" varchar,
  	"address" varchar,
  	"latitude" numeric,
  	"longitude" numeric,
  	"description" jsonb,
  	"image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_locations_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."_locations_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar,
  	"version_slug" varchar,
  	"version_address" varchar,
  	"version_latitude" numeric,
  	"version_longitude" numeric,
  	"version_description" jsonb,
  	"version_image_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__locations_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."pages_blocks_hero_buttons" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"href" varchar,
  	"variant" "cms"."enum_pages_blocks_hero_buttons_variant" DEFAULT 'default'
  );
  
  CREATE TABLE "cms"."pages_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"badge_text" varchar,
  	"badge_link_text" varchar,
  	"badge_link_href" varchar,
  	"mockup_light_id" integer,
  	"mockup_dark_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "cms"."pages_blocks_items_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"icon" "cms"."enum_pages_blocks_items_items_icon"
  );
  
  CREATE TABLE "cms"."pages_blocks_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "cms"."pages_blocks_logos_logos" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"image_id" integer
  );
  
  CREATE TABLE "cms"."pages_blocks_logos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"badge_text" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "cms"."pages_blocks_stats_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"value" varchar,
  	"suffix" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "cms"."pages_blocks_stats" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "cms"."pages_blocks_cta_buttons" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"href" varchar,
  	"variant" "cms"."enum_pages_blocks_cta_buttons_variant" DEFAULT 'default'
  );
  
  CREATE TABLE "cms"."pages_blocks_cta" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "cms"."pages_blocks_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar
  );
  
  CREATE TABLE "cms"."pages_blocks_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "cms"."pages_blocks_prose" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"content" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "cms"."pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."_pages_v_blocks_hero_buttons" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"href" varchar,
  	"variant" "cms"."enum__pages_v_blocks_hero_buttons_variant" DEFAULT 'default',
  	"_uuid" varchar
  );
  
  CREATE TABLE "cms"."_pages_v_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"badge_text" varchar,
  	"badge_link_text" varchar,
  	"badge_link_href" varchar,
  	"mockup_light_id" integer,
  	"mockup_dark_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "cms"."_pages_v_blocks_items_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"icon" "cms"."enum__pages_v_blocks_items_items_icon",
  	"_uuid" varchar
  );
  
  CREATE TABLE "cms"."_pages_v_blocks_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "cms"."_pages_v_blocks_logos_logos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"image_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "cms"."_pages_v_blocks_logos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"badge_text" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "cms"."_pages_v_blocks_stats_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"value" varchar,
  	"suffix" varchar,
  	"description" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "cms"."_pages_v_blocks_stats" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "cms"."_pages_v_blocks_cta_buttons" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"href" varchar,
  	"variant" "cms"."enum__pages_v_blocks_cta_buttons_variant" DEFAULT 'default',
  	"_uuid" varchar
  );
  
  CREATE TABLE "cms"."_pages_v_blocks_cta" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "cms"."_pages_v_blocks_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "cms"."_pages_v_blocks_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "cms"."_pages_v_blocks_prose" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"content" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "cms"."_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_meta_image_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "cms"."payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"articles_id" integer,
  	"events_id" integer,
  	"videos_id" integer,
  	"audio_id" integer,
  	"photos_id" integer,
  	"locations_id" integer,
  	"pages_id" integer
  );
  
  CREATE TABLE "cms"."payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "cms"."payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."site_settings_header_submenu" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"url" varchar NOT NULL,
  	"description" varchar
  );
  
  CREATE TABLE "cms"."site_settings_header" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "cms"."site_settings_header_actions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"url" varchar NOT NULL,
  	"variant" "cms"."enum_site_settings_header_actions_variant" DEFAULT 'default',
  	"is_button" boolean DEFAULT true
  );
  
  CREATE TABLE "cms"."site_settings_footer_columns_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "cms"."site_settings_footer_columns" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL
  );
  
  CREATE TABLE "cms"."site_settings_footer_policies" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "cms"."site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"copyright" varchar,
  	"social_twitter" varchar,
  	"social_github" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "cms"."theme_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"app_name" varchar,
  	"brand_link_url" varchar,
  	"brand_link_new_tab" boolean DEFAULT false,
  	"app_icon_id" integer,
  	"logo_light_id" integer,
  	"logo_dark_id" integer,
  	"colors_light_background" varchar DEFAULT 'oklch(0.9875 0.0045 314.8053)',
  	"colors_light_foreground" varchar DEFAULT 'oklch(0.2277 0.0105 312.0161)',
  	"colors_light_card" varchar DEFAULT 'oklch(1 0 0)',
  	"colors_light_card_foreground" varchar DEFAULT 'oklch(0.2277 0.0105 312.0161)',
  	"colors_light_popover" varchar DEFAULT 'oklch(1 0 0)',
  	"colors_light_popover_foreground" varchar DEFAULT 'oklch(0.2277 0.0105 312.0161)',
  	"colors_light_primary" varchar DEFAULT 'oklch(0.533 0.236 264.19)',
  	"colors_light_primary_foreground" varchar DEFAULT 'oklch(1 0 0)',
  	"colors_light_secondary" varchar DEFAULT 'oklch(0.967 0.0106 316.4921)',
  	"colors_light_secondary_foreground" varchar DEFAULT 'oklch(0.4536 0.0226 309.5036)',
  	"colors_light_muted" varchar DEFAULT 'oklch(0.967 0.0106 316.4921)',
  	"colors_light_muted_foreground" varchar DEFAULT 'oklch(0.5653 0.021 306.4429)',
  	"colors_light_accent" varchar DEFAULT 'oklch(0.967 0.0106 316.4921)',
  	"colors_light_accent_foreground" varchar DEFAULT 'oklch(0.533 0.236 264.19)',
  	"colors_light_destructive" varchar DEFAULT 'oklch(0.6368 0.2078 25.3313)',
  	"colors_light_destructive_foreground" varchar DEFAULT 'oklch(1 0 0)',
  	"colors_light_border" varchar DEFAULT 'oklch(0.9419 0.016 310.0997)',
  	"colors_light_input" varchar DEFAULT 'oklch(1 0 0)',
  	"colors_light_ring" varchar DEFAULT 'oklch(0.533 0.236 264.19)',
  	"colors_light_chart1" varchar DEFAULT 'oklch(0.533 0.236 264.19)',
  	"colors_light_chart2" varchar DEFAULT 'oklch(0.6747 0.1492 264.19)',
  	"colors_light_chart3" varchar DEFAULT 'oklch(0.7729 0.1045 264.19)',
  	"colors_light_chart4" varchar DEFAULT 'oklch(0.8625 0.0636 264.19)',
  	"colors_light_chart5" varchar DEFAULT 'oklch(0.9411 0.0261 264.19)',
  	"colors_light_sidebar" varchar DEFAULT 'oklch(0.967 0.0106 316.4921)',
  	"colors_light_sidebar_foreground" varchar DEFAULT 'oklch(0.4536 0.0226 309.5036)',
  	"colors_light_sidebar_primary" varchar DEFAULT 'oklch(0.533 0.236 264.19)',
  	"colors_light_sidebar_primary_foreground" varchar DEFAULT 'oklch(1 0 0)',
  	"colors_light_sidebar_accent" varchar DEFAULT 'oklch(0.9419 0.016 310.0997)',
  	"colors_light_sidebar_accent_foreground" varchar DEFAULT 'oklch(0.533 0.236 264.19)',
  	"colors_light_sidebar_border" varchar DEFAULT 'oklch(0.9155 0.0235 310.6964)',
  	"colors_light_sidebar_ring" varchar DEFAULT 'oklch(0.533 0.236 264.19)',
  	"colors_light_brand" varchar DEFAULT 'oklch(0.533 0.236 264.19)',
  	"colors_light_brand_foreground" varchar DEFAULT 'oklch(0.7039 0.1825 264.19)',
  	"colors_dark_background" varchar DEFAULT 'oklch(0.1836 0.0111 311.9111)',
  	"colors_dark_foreground" varchar DEFAULT 'oklch(0.9788 0.0057 308.3962)',
  	"colors_dark_card" varchar DEFAULT 'oklch(0.1836 0.0111 311.9111)',
  	"colors_dark_card_foreground" varchar DEFAULT 'oklch(0.9788 0.0057 308.3962)',
  	"colors_dark_popover" varchar DEFAULT 'oklch(0.1836 0.0111 311.9111)',
  	"colors_dark_popover_foreground" varchar DEFAULT 'oklch(0.9788 0.0057 308.3962)',
  	"colors_dark_primary" varchar DEFAULT 'oklch(0.533 0.236 264.19)',
  	"colors_dark_primary_foreground" varchar DEFAULT 'oklch(1 0 0)',
  	"colors_dark_secondary" varchar DEFAULT 'oklch(0.2551 0.0142 310.7968)',
  	"colors_dark_secondary_foreground" varchar DEFAULT 'oklch(0.721 0.0184 308.1777)',
  	"colors_dark_muted" varchar DEFAULT 'oklch(0.2551 0.0142 310.7968)',
  	"colors_dark_muted_foreground" varchar DEFAULT 'oklch(0.6288 0.0177 309.9946)',
  	"colors_dark_accent" varchar DEFAULT 'oklch(0.2551 0.0142 310.7968)',
  	"colors_dark_accent_foreground" varchar DEFAULT 'oklch(0.6747 0.1492 264.19)',
  	"colors_dark_destructive" varchar DEFAULT 'oklch(0.3958 0.1331 25.723)',
  	"colors_dark_destructive_foreground" varchar DEFAULT 'oklch(1 0 0)',
  	"colors_dark_border" varchar DEFAULT 'oklch(0.2941 0.0175 310.1142)',
  	"colors_dark_input" varchar DEFAULT 'oklch(0.2551 0.0142 310.7968)',
  	"colors_dark_ring" varchar DEFAULT 'oklch(0.533 0.236 264.19)',
  	"colors_dark_chart1" varchar DEFAULT 'oklch(0.6747 0.1492 264.19)',
  	"colors_dark_chart2" varchar DEFAULT 'oklch(0.5605 0.1911 264.19)',
  	"colors_dark_chart3" varchar DEFAULT 'oklch(0.4988 0.1668 264.19)',
  	"colors_dark_chart4" varchar DEFAULT 'oklch(0.4373 0.1428 264.19)',
  	"colors_dark_chart5" varchar DEFAULT 'oklch(0.3738 0.1177 264.19)',
  	"colors_dark_sidebar" varchar DEFAULT 'oklch(0.2103 0.0107 311.9806)',
  	"colors_dark_sidebar_foreground" varchar DEFAULT 'oklch(0.721 0.0184 308.1777)',
  	"colors_dark_sidebar_primary" varchar DEFAULT 'oklch(0.533 0.236 264.19)',
  	"colors_dark_sidebar_primary_foreground" varchar DEFAULT 'oklch(1 0 0)',
  	"colors_dark_sidebar_accent" varchar DEFAULT 'oklch(0.2551 0.0142 310.7968)',
  	"colors_dark_sidebar_accent_foreground" varchar DEFAULT 'oklch(0.6747 0.1492 264.19)',
  	"colors_dark_sidebar_border" varchar DEFAULT 'oklch(0.2941 0.0175 310.1142)',
  	"colors_dark_sidebar_ring" varchar DEFAULT 'oklch(0.533 0.236 264.19)',
  	"colors_dark_brand" varchar DEFAULT 'oklch(0.6747 0.1492 264.19)',
  	"colors_dark_brand_foreground" varchar DEFAULT 'oklch(0.8 0.12 264.19)',
  	"font_sans" "cms"."enum_theme_settings_font_sans" DEFAULT 'geist',
  	"font_serif" "cms"."enum_theme_settings_font_serif" DEFAULT 'merriweather',
  	"font_mono" "cms"."enum_theme_settings_font_mono" DEFAULT 'geist-mono',
  	"letter_spacing" varchar DEFAULT '0rem',
  	"radius" varchar DEFAULT '0.75rem',
  	"spacing" varchar DEFAULT '0.25rem',
  	"shadow_color" varchar DEFAULT 'oklch(0 0 0)',
  	"shadow_opacity" numeric DEFAULT 0.1,
  	"shadow_blur_radius" numeric DEFAULT 10,
  	"shadow_spread" numeric DEFAULT 0,
  	"shadow_offset_x" numeric DEFAULT 0,
  	"shadow_offset_y" numeric DEFAULT 2,
  	"_status" "cms"."enum_theme_settings_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "cms"."_theme_settings_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_app_name" varchar,
  	"version_brand_link_url" varchar,
  	"version_brand_link_new_tab" boolean DEFAULT false,
  	"version_app_icon_id" integer,
  	"version_logo_light_id" integer,
  	"version_logo_dark_id" integer,
  	"version_colors_light_background" varchar DEFAULT 'oklch(0.9875 0.0045 314.8053)',
  	"version_colors_light_foreground" varchar DEFAULT 'oklch(0.2277 0.0105 312.0161)',
  	"version_colors_light_card" varchar DEFAULT 'oklch(1 0 0)',
  	"version_colors_light_card_foreground" varchar DEFAULT 'oklch(0.2277 0.0105 312.0161)',
  	"version_colors_light_popover" varchar DEFAULT 'oklch(1 0 0)',
  	"version_colors_light_popover_foreground" varchar DEFAULT 'oklch(0.2277 0.0105 312.0161)',
  	"version_colors_light_primary" varchar DEFAULT 'oklch(0.533 0.236 264.19)',
  	"version_colors_light_primary_foreground" varchar DEFAULT 'oklch(1 0 0)',
  	"version_colors_light_secondary" varchar DEFAULT 'oklch(0.967 0.0106 316.4921)',
  	"version_colors_light_secondary_foreground" varchar DEFAULT 'oklch(0.4536 0.0226 309.5036)',
  	"version_colors_light_muted" varchar DEFAULT 'oklch(0.967 0.0106 316.4921)',
  	"version_colors_light_muted_foreground" varchar DEFAULT 'oklch(0.5653 0.021 306.4429)',
  	"version_colors_light_accent" varchar DEFAULT 'oklch(0.967 0.0106 316.4921)',
  	"version_colors_light_accent_foreground" varchar DEFAULT 'oklch(0.533 0.236 264.19)',
  	"version_colors_light_destructive" varchar DEFAULT 'oklch(0.6368 0.2078 25.3313)',
  	"version_colors_light_destructive_foreground" varchar DEFAULT 'oklch(1 0 0)',
  	"version_colors_light_border" varchar DEFAULT 'oklch(0.9419 0.016 310.0997)',
  	"version_colors_light_input" varchar DEFAULT 'oklch(1 0 0)',
  	"version_colors_light_ring" varchar DEFAULT 'oklch(0.533 0.236 264.19)',
  	"version_colors_light_chart1" varchar DEFAULT 'oklch(0.533 0.236 264.19)',
  	"version_colors_light_chart2" varchar DEFAULT 'oklch(0.6747 0.1492 264.19)',
  	"version_colors_light_chart3" varchar DEFAULT 'oklch(0.7729 0.1045 264.19)',
  	"version_colors_light_chart4" varchar DEFAULT 'oklch(0.8625 0.0636 264.19)',
  	"version_colors_light_chart5" varchar DEFAULT 'oklch(0.9411 0.0261 264.19)',
  	"version_colors_light_sidebar" varchar DEFAULT 'oklch(0.967 0.0106 316.4921)',
  	"version_colors_light_sidebar_foreground" varchar DEFAULT 'oklch(0.4536 0.0226 309.5036)',
  	"version_colors_light_sidebar_primary" varchar DEFAULT 'oklch(0.533 0.236 264.19)',
  	"version_colors_light_sidebar_primary_foreground" varchar DEFAULT 'oklch(1 0 0)',
  	"version_colors_light_sidebar_accent" varchar DEFAULT 'oklch(0.9419 0.016 310.0997)',
  	"version_colors_light_sidebar_accent_foreground" varchar DEFAULT 'oklch(0.533 0.236 264.19)',
  	"version_colors_light_sidebar_border" varchar DEFAULT 'oklch(0.9155 0.0235 310.6964)',
  	"version_colors_light_sidebar_ring" varchar DEFAULT 'oklch(0.533 0.236 264.19)',
  	"version_colors_light_brand" varchar DEFAULT 'oklch(0.533 0.236 264.19)',
  	"version_colors_light_brand_foreground" varchar DEFAULT 'oklch(0.7039 0.1825 264.19)',
  	"version_colors_dark_background" varchar DEFAULT 'oklch(0.1836 0.0111 311.9111)',
  	"version_colors_dark_foreground" varchar DEFAULT 'oklch(0.9788 0.0057 308.3962)',
  	"version_colors_dark_card" varchar DEFAULT 'oklch(0.1836 0.0111 311.9111)',
  	"version_colors_dark_card_foreground" varchar DEFAULT 'oklch(0.9788 0.0057 308.3962)',
  	"version_colors_dark_popover" varchar DEFAULT 'oklch(0.1836 0.0111 311.9111)',
  	"version_colors_dark_popover_foreground" varchar DEFAULT 'oklch(0.9788 0.0057 308.3962)',
  	"version_colors_dark_primary" varchar DEFAULT 'oklch(0.533 0.236 264.19)',
  	"version_colors_dark_primary_foreground" varchar DEFAULT 'oklch(1 0 0)',
  	"version_colors_dark_secondary" varchar DEFAULT 'oklch(0.2551 0.0142 310.7968)',
  	"version_colors_dark_secondary_foreground" varchar DEFAULT 'oklch(0.721 0.0184 308.1777)',
  	"version_colors_dark_muted" varchar DEFAULT 'oklch(0.2551 0.0142 310.7968)',
  	"version_colors_dark_muted_foreground" varchar DEFAULT 'oklch(0.6288 0.0177 309.9946)',
  	"version_colors_dark_accent" varchar DEFAULT 'oklch(0.2551 0.0142 310.7968)',
  	"version_colors_dark_accent_foreground" varchar DEFAULT 'oklch(0.6747 0.1492 264.19)',
  	"version_colors_dark_destructive" varchar DEFAULT 'oklch(0.3958 0.1331 25.723)',
  	"version_colors_dark_destructive_foreground" varchar DEFAULT 'oklch(1 0 0)',
  	"version_colors_dark_border" varchar DEFAULT 'oklch(0.2941 0.0175 310.1142)',
  	"version_colors_dark_input" varchar DEFAULT 'oklch(0.2551 0.0142 310.7968)',
  	"version_colors_dark_ring" varchar DEFAULT 'oklch(0.533 0.236 264.19)',
  	"version_colors_dark_chart1" varchar DEFAULT 'oklch(0.6747 0.1492 264.19)',
  	"version_colors_dark_chart2" varchar DEFAULT 'oklch(0.5605 0.1911 264.19)',
  	"version_colors_dark_chart3" varchar DEFAULT 'oklch(0.4988 0.1668 264.19)',
  	"version_colors_dark_chart4" varchar DEFAULT 'oklch(0.4373 0.1428 264.19)',
  	"version_colors_dark_chart5" varchar DEFAULT 'oklch(0.3738 0.1177 264.19)',
  	"version_colors_dark_sidebar" varchar DEFAULT 'oklch(0.2103 0.0107 311.9806)',
  	"version_colors_dark_sidebar_foreground" varchar DEFAULT 'oklch(0.721 0.0184 308.1777)',
  	"version_colors_dark_sidebar_primary" varchar DEFAULT 'oklch(0.533 0.236 264.19)',
  	"version_colors_dark_sidebar_primary_foreground" varchar DEFAULT 'oklch(1 0 0)',
  	"version_colors_dark_sidebar_accent" varchar DEFAULT 'oklch(0.2551 0.0142 310.7968)',
  	"version_colors_dark_sidebar_accent_foreground" varchar DEFAULT 'oklch(0.6747 0.1492 264.19)',
  	"version_colors_dark_sidebar_border" varchar DEFAULT 'oklch(0.2941 0.0175 310.1142)',
  	"version_colors_dark_sidebar_ring" varchar DEFAULT 'oklch(0.533 0.236 264.19)',
  	"version_colors_dark_brand" varchar DEFAULT 'oklch(0.6747 0.1492 264.19)',
  	"version_colors_dark_brand_foreground" varchar DEFAULT 'oklch(0.8 0.12 264.19)',
  	"version_font_sans" "cms"."enum__theme_settings_v_version_font_sans" DEFAULT 'geist',
  	"version_font_serif" "cms"."enum__theme_settings_v_version_font_serif" DEFAULT 'merriweather',
  	"version_font_mono" "cms"."enum__theme_settings_v_version_font_mono" DEFAULT 'geist-mono',
  	"version_letter_spacing" varchar DEFAULT '0rem',
  	"version_radius" varchar DEFAULT '0.75rem',
  	"version_spacing" varchar DEFAULT '0.25rem',
  	"version_shadow_color" varchar DEFAULT 'oklch(0 0 0)',
  	"version_shadow_opacity" numeric DEFAULT 0.1,
  	"version_shadow_blur_radius" numeric DEFAULT 10,
  	"version_shadow_spread" numeric DEFAULT 0,
  	"version_shadow_offset_x" numeric DEFAULT 0,
  	"version_shadow_offset_y" numeric DEFAULT 2,
  	"version__status" "cms"."enum__theme_settings_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  ALTER TABLE "cms"."articles" ADD CONSTRAINT "articles_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."articles" ADD CONSTRAINT "articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."articles" ADD CONSTRAINT "articles_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."articles_texts" ADD CONSTRAINT "articles_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_articles_v" ADD CONSTRAINT "_articles_v_parent_id_articles_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_articles_v" ADD CONSTRAINT "_articles_v_version_hero_image_id_media_id_fk" FOREIGN KEY ("version_hero_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_articles_v" ADD CONSTRAINT "_articles_v_version_author_id_users_id_fk" FOREIGN KEY ("version_author_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_articles_v" ADD CONSTRAINT "_articles_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_articles_v_texts" ADD CONSTRAINT "_articles_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."events" ADD CONSTRAINT "events_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "cms"."locations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."events" ADD CONSTRAINT "events_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_events_v" ADD CONSTRAINT "_events_v_parent_id_events_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_events_v" ADD CONSTRAINT "_events_v_version_location_id_locations_id_fk" FOREIGN KEY ("version_location_id") REFERENCES "cms"."locations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_events_v" ADD CONSTRAINT "_events_v_version_image_id_media_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."videos" ADD CONSTRAINT "videos_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."videos" ADD CONSTRAINT "videos_thumbnail_id_media_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_videos_v" ADD CONSTRAINT "_videos_v_parent_id_videos_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."videos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_videos_v" ADD CONSTRAINT "_videos_v_version_file_id_media_id_fk" FOREIGN KEY ("version_file_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_videos_v" ADD CONSTRAINT "_videos_v_version_thumbnail_id_media_id_fk" FOREIGN KEY ("version_thumbnail_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."audio" ADD CONSTRAINT "audio_audio_file_id_media_id_fk" FOREIGN KEY ("audio_file_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_audio_v" ADD CONSTRAINT "_audio_v_parent_id_audio_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."audio"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_audio_v" ADD CONSTRAINT "_audio_v_version_audio_file_id_media_id_fk" FOREIGN KEY ("version_audio_file_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."photos_gallery" ADD CONSTRAINT "photos_gallery_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."photos_gallery" ADD CONSTRAINT "photos_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."photos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."photos" ADD CONSTRAINT "photos_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_photos_v_version_gallery" ADD CONSTRAINT "_photos_v_version_gallery_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_photos_v_version_gallery" ADD CONSTRAINT "_photos_v_version_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_photos_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_photos_v" ADD CONSTRAINT "_photos_v_parent_id_photos_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."photos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_photos_v" ADD CONSTRAINT "_photos_v_version_image_id_media_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."locations" ADD CONSTRAINT "locations_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_locations_v" ADD CONSTRAINT "_locations_v_parent_id_locations_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."locations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_locations_v" ADD CONSTRAINT "_locations_v_version_image_id_media_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."pages_blocks_hero_buttons" ADD CONSTRAINT "pages_blocks_hero_buttons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."pages_blocks_hero"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."pages_blocks_hero" ADD CONSTRAINT "pages_blocks_hero_mockup_light_id_media_id_fk" FOREIGN KEY ("mockup_light_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."pages_blocks_hero" ADD CONSTRAINT "pages_blocks_hero_mockup_dark_id_media_id_fk" FOREIGN KEY ("mockup_dark_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."pages_blocks_hero" ADD CONSTRAINT "pages_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."pages_blocks_items_items" ADD CONSTRAINT "pages_blocks_items_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."pages_blocks_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."pages_blocks_items" ADD CONSTRAINT "pages_blocks_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."pages_blocks_logos_logos" ADD CONSTRAINT "pages_blocks_logos_logos_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."pages_blocks_logos_logos" ADD CONSTRAINT "pages_blocks_logos_logos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."pages_blocks_logos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."pages_blocks_logos" ADD CONSTRAINT "pages_blocks_logos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."pages_blocks_stats_items" ADD CONSTRAINT "pages_blocks_stats_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."pages_blocks_stats"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."pages_blocks_stats" ADD CONSTRAINT "pages_blocks_stats_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."pages_blocks_cta_buttons" ADD CONSTRAINT "pages_blocks_cta_buttons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."pages_blocks_cta"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."pages_blocks_cta" ADD CONSTRAINT "pages_blocks_cta_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."pages_blocks_faq_items" ADD CONSTRAINT "pages_blocks_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."pages_blocks_faq"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."pages_blocks_faq" ADD CONSTRAINT "pages_blocks_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."pages_blocks_prose" ADD CONSTRAINT "pages_blocks_prose_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."pages" ADD CONSTRAINT "pages_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v_blocks_hero_buttons" ADD CONSTRAINT "_pages_v_blocks_hero_buttons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_pages_v_blocks_hero"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v_blocks_hero" ADD CONSTRAINT "_pages_v_blocks_hero_mockup_light_id_media_id_fk" FOREIGN KEY ("mockup_light_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v_blocks_hero" ADD CONSTRAINT "_pages_v_blocks_hero_mockup_dark_id_media_id_fk" FOREIGN KEY ("mockup_dark_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v_blocks_hero" ADD CONSTRAINT "_pages_v_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v_blocks_items_items" ADD CONSTRAINT "_pages_v_blocks_items_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_pages_v_blocks_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v_blocks_items" ADD CONSTRAINT "_pages_v_blocks_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v_blocks_logos_logos" ADD CONSTRAINT "_pages_v_blocks_logos_logos_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v_blocks_logos_logos" ADD CONSTRAINT "_pages_v_blocks_logos_logos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_pages_v_blocks_logos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v_blocks_logos" ADD CONSTRAINT "_pages_v_blocks_logos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v_blocks_stats_items" ADD CONSTRAINT "_pages_v_blocks_stats_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_pages_v_blocks_stats"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v_blocks_stats" ADD CONSTRAINT "_pages_v_blocks_stats_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v_blocks_cta_buttons" ADD CONSTRAINT "_pages_v_blocks_cta_buttons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_pages_v_blocks_cta"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v_blocks_cta" ADD CONSTRAINT "_pages_v_blocks_cta_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v_blocks_faq_items" ADD CONSTRAINT "_pages_v_blocks_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_pages_v_blocks_faq"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v_blocks_faq" ADD CONSTRAINT "_pages_v_blocks_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v_blocks_prose" ADD CONSTRAINT "_pages_v_blocks_prose_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v" ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v" ADD CONSTRAINT "_pages_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "cms"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "cms"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "cms"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "cms"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_videos_fk" FOREIGN KEY ("videos_id") REFERENCES "cms"."videos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audio_fk" FOREIGN KEY ("audio_id") REFERENCES "cms"."audio"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_photos_fk" FOREIGN KEY ("photos_id") REFERENCES "cms"."photos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_locations_fk" FOREIGN KEY ("locations_id") REFERENCES "cms"."locations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "cms"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "cms"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."site_settings_header_submenu" ADD CONSTRAINT "site_settings_header_submenu_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."site_settings_header"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."site_settings_header" ADD CONSTRAINT "site_settings_header_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."site_settings_header_actions" ADD CONSTRAINT "site_settings_header_actions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."site_settings_footer_columns_links" ADD CONSTRAINT "site_settings_footer_columns_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."site_settings_footer_columns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."site_settings_footer_columns" ADD CONSTRAINT "site_settings_footer_columns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."site_settings_footer_policies" ADD CONSTRAINT "site_settings_footer_policies_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."theme_settings" ADD CONSTRAINT "theme_settings_app_icon_id_media_id_fk" FOREIGN KEY ("app_icon_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."theme_settings" ADD CONSTRAINT "theme_settings_logo_light_id_media_id_fk" FOREIGN KEY ("logo_light_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."theme_settings" ADD CONSTRAINT "theme_settings_logo_dark_id_media_id_fk" FOREIGN KEY ("logo_dark_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_theme_settings_v" ADD CONSTRAINT "_theme_settings_v_version_app_icon_id_media_id_fk" FOREIGN KEY ("version_app_icon_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_theme_settings_v" ADD CONSTRAINT "_theme_settings_v_version_logo_light_id_media_id_fk" FOREIGN KEY ("version_logo_light_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_theme_settings_v" ADD CONSTRAINT "_theme_settings_v_version_logo_dark_id_media_id_fk" FOREIGN KEY ("version_logo_dark_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_email_idx" ON "cms"."users" USING btree ("email");
  CREATE UNIQUE INDEX "users_supabase_user_id_idx" ON "cms"."users" USING btree ("supabase_user_id");
  CREATE INDEX "users_updated_at_idx" ON "cms"."users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "cms"."users" USING btree ("created_at");
  CREATE INDEX "media_updated_at_idx" ON "cms"."media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "cms"."media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "cms"."media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "cms"."media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "cms"."media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_hero_sizes_hero_filename_idx" ON "cms"."media" USING btree ("sizes_hero_filename");
  CREATE UNIQUE INDEX "articles_slug_idx" ON "cms"."articles" USING btree ("slug");
  CREATE INDEX "articles_hero_image_idx" ON "cms"."articles" USING btree ("hero_image_id");
  CREATE INDEX "articles_author_idx" ON "cms"."articles" USING btree ("author_id");
  CREATE INDEX "articles_meta_meta_image_idx" ON "cms"."articles" USING btree ("meta_image_id");
  CREATE INDEX "articles_updated_at_idx" ON "cms"."articles" USING btree ("updated_at");
  CREATE INDEX "articles_created_at_idx" ON "cms"."articles" USING btree ("created_at");
  CREATE INDEX "articles__status_idx" ON "cms"."articles" USING btree ("_status");
  CREATE INDEX "articles_texts_order_parent" ON "cms"."articles_texts" USING btree ("order","parent_id");
  CREATE INDEX "_articles_v_parent_idx" ON "cms"."_articles_v" USING btree ("parent_id");
  CREATE INDEX "_articles_v_version_version_slug_idx" ON "cms"."_articles_v" USING btree ("version_slug");
  CREATE INDEX "_articles_v_version_version_hero_image_idx" ON "cms"."_articles_v" USING btree ("version_hero_image_id");
  CREATE INDEX "_articles_v_version_version_author_idx" ON "cms"."_articles_v" USING btree ("version_author_id");
  CREATE INDEX "_articles_v_version_meta_version_meta_image_idx" ON "cms"."_articles_v" USING btree ("version_meta_image_id");
  CREATE INDEX "_articles_v_version_version_updated_at_idx" ON "cms"."_articles_v" USING btree ("version_updated_at");
  CREATE INDEX "_articles_v_version_version_created_at_idx" ON "cms"."_articles_v" USING btree ("version_created_at");
  CREATE INDEX "_articles_v_version_version__status_idx" ON "cms"."_articles_v" USING btree ("version__status");
  CREATE INDEX "_articles_v_created_at_idx" ON "cms"."_articles_v" USING btree ("created_at");
  CREATE INDEX "_articles_v_updated_at_idx" ON "cms"."_articles_v" USING btree ("updated_at");
  CREATE INDEX "_articles_v_latest_idx" ON "cms"."_articles_v" USING btree ("latest");
  CREATE INDEX "_articles_v_texts_order_parent" ON "cms"."_articles_v_texts" USING btree ("order","parent_id");
  CREATE UNIQUE INDEX "events_slug_idx" ON "cms"."events" USING btree ("slug");
  CREATE INDEX "events_location_idx" ON "cms"."events" USING btree ("location_id");
  CREATE INDEX "events_image_idx" ON "cms"."events" USING btree ("image_id");
  CREATE INDEX "events_updated_at_idx" ON "cms"."events" USING btree ("updated_at");
  CREATE INDEX "events_created_at_idx" ON "cms"."events" USING btree ("created_at");
  CREATE INDEX "events__status_idx" ON "cms"."events" USING btree ("_status");
  CREATE INDEX "_events_v_parent_idx" ON "cms"."_events_v" USING btree ("parent_id");
  CREATE INDEX "_events_v_version_version_slug_idx" ON "cms"."_events_v" USING btree ("version_slug");
  CREATE INDEX "_events_v_version_version_location_idx" ON "cms"."_events_v" USING btree ("version_location_id");
  CREATE INDEX "_events_v_version_version_image_idx" ON "cms"."_events_v" USING btree ("version_image_id");
  CREATE INDEX "_events_v_version_version_updated_at_idx" ON "cms"."_events_v" USING btree ("version_updated_at");
  CREATE INDEX "_events_v_version_version_created_at_idx" ON "cms"."_events_v" USING btree ("version_created_at");
  CREATE INDEX "_events_v_version_version__status_idx" ON "cms"."_events_v" USING btree ("version__status");
  CREATE INDEX "_events_v_created_at_idx" ON "cms"."_events_v" USING btree ("created_at");
  CREATE INDEX "_events_v_updated_at_idx" ON "cms"."_events_v" USING btree ("updated_at");
  CREATE INDEX "_events_v_latest_idx" ON "cms"."_events_v" USING btree ("latest");
  CREATE UNIQUE INDEX "videos_slug_idx" ON "cms"."videos" USING btree ("slug");
  CREATE INDEX "videos_file_idx" ON "cms"."videos" USING btree ("file_id");
  CREATE INDEX "videos_thumbnail_idx" ON "cms"."videos" USING btree ("thumbnail_id");
  CREATE INDEX "videos_updated_at_idx" ON "cms"."videos" USING btree ("updated_at");
  CREATE INDEX "videos_created_at_idx" ON "cms"."videos" USING btree ("created_at");
  CREATE INDEX "videos__status_idx" ON "cms"."videos" USING btree ("_status");
  CREATE INDEX "_videos_v_parent_idx" ON "cms"."_videos_v" USING btree ("parent_id");
  CREATE INDEX "_videos_v_version_version_slug_idx" ON "cms"."_videos_v" USING btree ("version_slug");
  CREATE INDEX "_videos_v_version_version_file_idx" ON "cms"."_videos_v" USING btree ("version_file_id");
  CREATE INDEX "_videos_v_version_version_thumbnail_idx" ON "cms"."_videos_v" USING btree ("version_thumbnail_id");
  CREATE INDEX "_videos_v_version_version_updated_at_idx" ON "cms"."_videos_v" USING btree ("version_updated_at");
  CREATE INDEX "_videos_v_version_version_created_at_idx" ON "cms"."_videos_v" USING btree ("version_created_at");
  CREATE INDEX "_videos_v_version_version__status_idx" ON "cms"."_videos_v" USING btree ("version__status");
  CREATE INDEX "_videos_v_created_at_idx" ON "cms"."_videos_v" USING btree ("created_at");
  CREATE INDEX "_videos_v_updated_at_idx" ON "cms"."_videos_v" USING btree ("updated_at");
  CREATE INDEX "_videos_v_latest_idx" ON "cms"."_videos_v" USING btree ("latest");
  CREATE UNIQUE INDEX "audio_slug_idx" ON "cms"."audio" USING btree ("slug");
  CREATE INDEX "audio_audio_file_idx" ON "cms"."audio" USING btree ("audio_file_id");
  CREATE INDEX "audio_updated_at_idx" ON "cms"."audio" USING btree ("updated_at");
  CREATE INDEX "audio_created_at_idx" ON "cms"."audio" USING btree ("created_at");
  CREATE INDEX "audio__status_idx" ON "cms"."audio" USING btree ("_status");
  CREATE INDEX "_audio_v_parent_idx" ON "cms"."_audio_v" USING btree ("parent_id");
  CREATE INDEX "_audio_v_version_version_slug_idx" ON "cms"."_audio_v" USING btree ("version_slug");
  CREATE INDEX "_audio_v_version_version_audio_file_idx" ON "cms"."_audio_v" USING btree ("version_audio_file_id");
  CREATE INDEX "_audio_v_version_version_updated_at_idx" ON "cms"."_audio_v" USING btree ("version_updated_at");
  CREATE INDEX "_audio_v_version_version_created_at_idx" ON "cms"."_audio_v" USING btree ("version_created_at");
  CREATE INDEX "_audio_v_version_version__status_idx" ON "cms"."_audio_v" USING btree ("version__status");
  CREATE INDEX "_audio_v_created_at_idx" ON "cms"."_audio_v" USING btree ("created_at");
  CREATE INDEX "_audio_v_updated_at_idx" ON "cms"."_audio_v" USING btree ("updated_at");
  CREATE INDEX "_audio_v_latest_idx" ON "cms"."_audio_v" USING btree ("latest");
  CREATE INDEX "photos_gallery_order_idx" ON "cms"."photos_gallery" USING btree ("_order");
  CREATE INDEX "photos_gallery_parent_id_idx" ON "cms"."photos_gallery" USING btree ("_parent_id");
  CREATE INDEX "photos_gallery_image_idx" ON "cms"."photos_gallery" USING btree ("image_id");
  CREATE UNIQUE INDEX "photos_slug_idx" ON "cms"."photos" USING btree ("slug");
  CREATE INDEX "photos_image_idx" ON "cms"."photos" USING btree ("image_id");
  CREATE INDEX "photos_updated_at_idx" ON "cms"."photos" USING btree ("updated_at");
  CREATE INDEX "photos_created_at_idx" ON "cms"."photos" USING btree ("created_at");
  CREATE INDEX "photos__status_idx" ON "cms"."photos" USING btree ("_status");
  CREATE INDEX "_photos_v_version_gallery_order_idx" ON "cms"."_photos_v_version_gallery" USING btree ("_order");
  CREATE INDEX "_photos_v_version_gallery_parent_id_idx" ON "cms"."_photos_v_version_gallery" USING btree ("_parent_id");
  CREATE INDEX "_photos_v_version_gallery_image_idx" ON "cms"."_photos_v_version_gallery" USING btree ("image_id");
  CREATE INDEX "_photos_v_parent_idx" ON "cms"."_photos_v" USING btree ("parent_id");
  CREATE INDEX "_photos_v_version_version_slug_idx" ON "cms"."_photos_v" USING btree ("version_slug");
  CREATE INDEX "_photos_v_version_version_image_idx" ON "cms"."_photos_v" USING btree ("version_image_id");
  CREATE INDEX "_photos_v_version_version_updated_at_idx" ON "cms"."_photos_v" USING btree ("version_updated_at");
  CREATE INDEX "_photos_v_version_version_created_at_idx" ON "cms"."_photos_v" USING btree ("version_created_at");
  CREATE INDEX "_photos_v_version_version__status_idx" ON "cms"."_photos_v" USING btree ("version__status");
  CREATE INDEX "_photos_v_created_at_idx" ON "cms"."_photos_v" USING btree ("created_at");
  CREATE INDEX "_photos_v_updated_at_idx" ON "cms"."_photos_v" USING btree ("updated_at");
  CREATE INDEX "_photos_v_latest_idx" ON "cms"."_photos_v" USING btree ("latest");
  CREATE UNIQUE INDEX "locations_slug_idx" ON "cms"."locations" USING btree ("slug");
  CREATE INDEX "locations_image_idx" ON "cms"."locations" USING btree ("image_id");
  CREATE INDEX "locations_updated_at_idx" ON "cms"."locations" USING btree ("updated_at");
  CREATE INDEX "locations_created_at_idx" ON "cms"."locations" USING btree ("created_at");
  CREATE INDEX "locations__status_idx" ON "cms"."locations" USING btree ("_status");
  CREATE INDEX "_locations_v_parent_idx" ON "cms"."_locations_v" USING btree ("parent_id");
  CREATE INDEX "_locations_v_version_version_slug_idx" ON "cms"."_locations_v" USING btree ("version_slug");
  CREATE INDEX "_locations_v_version_version_image_idx" ON "cms"."_locations_v" USING btree ("version_image_id");
  CREATE INDEX "_locations_v_version_version_updated_at_idx" ON "cms"."_locations_v" USING btree ("version_updated_at");
  CREATE INDEX "_locations_v_version_version_created_at_idx" ON "cms"."_locations_v" USING btree ("version_created_at");
  CREATE INDEX "_locations_v_version_version__status_idx" ON "cms"."_locations_v" USING btree ("version__status");
  CREATE INDEX "_locations_v_created_at_idx" ON "cms"."_locations_v" USING btree ("created_at");
  CREATE INDEX "_locations_v_updated_at_idx" ON "cms"."_locations_v" USING btree ("updated_at");
  CREATE INDEX "_locations_v_latest_idx" ON "cms"."_locations_v" USING btree ("latest");
  CREATE INDEX "pages_blocks_hero_buttons_order_idx" ON "cms"."pages_blocks_hero_buttons" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_buttons_parent_id_idx" ON "cms"."pages_blocks_hero_buttons" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_order_idx" ON "cms"."pages_blocks_hero" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_parent_id_idx" ON "cms"."pages_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_path_idx" ON "cms"."pages_blocks_hero" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_mockup_light_idx" ON "cms"."pages_blocks_hero" USING btree ("mockup_light_id");
  CREATE INDEX "pages_blocks_hero_mockup_dark_idx" ON "cms"."pages_blocks_hero" USING btree ("mockup_dark_id");
  CREATE INDEX "pages_blocks_items_items_order_idx" ON "cms"."pages_blocks_items_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_items_items_parent_id_idx" ON "cms"."pages_blocks_items_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_items_order_idx" ON "cms"."pages_blocks_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_items_parent_id_idx" ON "cms"."pages_blocks_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_items_path_idx" ON "cms"."pages_blocks_items" USING btree ("_path");
  CREATE INDEX "pages_blocks_logos_logos_order_idx" ON "cms"."pages_blocks_logos_logos" USING btree ("_order");
  CREATE INDEX "pages_blocks_logos_logos_parent_id_idx" ON "cms"."pages_blocks_logos_logos" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_logos_logos_image_idx" ON "cms"."pages_blocks_logos_logos" USING btree ("image_id");
  CREATE INDEX "pages_blocks_logos_order_idx" ON "cms"."pages_blocks_logos" USING btree ("_order");
  CREATE INDEX "pages_blocks_logos_parent_id_idx" ON "cms"."pages_blocks_logos" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_logos_path_idx" ON "cms"."pages_blocks_logos" USING btree ("_path");
  CREATE INDEX "pages_blocks_stats_items_order_idx" ON "cms"."pages_blocks_stats_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_stats_items_parent_id_idx" ON "cms"."pages_blocks_stats_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_stats_order_idx" ON "cms"."pages_blocks_stats" USING btree ("_order");
  CREATE INDEX "pages_blocks_stats_parent_id_idx" ON "cms"."pages_blocks_stats" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_stats_path_idx" ON "cms"."pages_blocks_stats" USING btree ("_path");
  CREATE INDEX "pages_blocks_cta_buttons_order_idx" ON "cms"."pages_blocks_cta_buttons" USING btree ("_order");
  CREATE INDEX "pages_blocks_cta_buttons_parent_id_idx" ON "cms"."pages_blocks_cta_buttons" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_cta_order_idx" ON "cms"."pages_blocks_cta" USING btree ("_order");
  CREATE INDEX "pages_blocks_cta_parent_id_idx" ON "cms"."pages_blocks_cta" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_cta_path_idx" ON "cms"."pages_blocks_cta" USING btree ("_path");
  CREATE INDEX "pages_blocks_faq_items_order_idx" ON "cms"."pages_blocks_faq_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_faq_items_parent_id_idx" ON "cms"."pages_blocks_faq_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_faq_order_idx" ON "cms"."pages_blocks_faq" USING btree ("_order");
  CREATE INDEX "pages_blocks_faq_parent_id_idx" ON "cms"."pages_blocks_faq" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_faq_path_idx" ON "cms"."pages_blocks_faq" USING btree ("_path");
  CREATE INDEX "pages_blocks_prose_order_idx" ON "cms"."pages_blocks_prose" USING btree ("_order");
  CREATE INDEX "pages_blocks_prose_parent_id_idx" ON "cms"."pages_blocks_prose" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_prose_path_idx" ON "cms"."pages_blocks_prose" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_slug_idx" ON "cms"."pages" USING btree ("slug");
  CREATE INDEX "pages_meta_meta_image_idx" ON "cms"."pages" USING btree ("meta_image_id");
  CREATE INDEX "pages_updated_at_idx" ON "cms"."pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "cms"."pages" USING btree ("created_at");
  CREATE INDEX "pages__status_idx" ON "cms"."pages" USING btree ("_status");
  CREATE INDEX "_pages_v_blocks_hero_buttons_order_idx" ON "cms"."_pages_v_blocks_hero_buttons" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_hero_buttons_parent_id_idx" ON "cms"."_pages_v_blocks_hero_buttons" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_hero_order_idx" ON "cms"."_pages_v_blocks_hero" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_hero_parent_id_idx" ON "cms"."_pages_v_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_hero_path_idx" ON "cms"."_pages_v_blocks_hero" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_hero_mockup_light_idx" ON "cms"."_pages_v_blocks_hero" USING btree ("mockup_light_id");
  CREATE INDEX "_pages_v_blocks_hero_mockup_dark_idx" ON "cms"."_pages_v_blocks_hero" USING btree ("mockup_dark_id");
  CREATE INDEX "_pages_v_blocks_items_items_order_idx" ON "cms"."_pages_v_blocks_items_items" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_items_items_parent_id_idx" ON "cms"."_pages_v_blocks_items_items" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_items_order_idx" ON "cms"."_pages_v_blocks_items" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_items_parent_id_idx" ON "cms"."_pages_v_blocks_items" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_items_path_idx" ON "cms"."_pages_v_blocks_items" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_logos_logos_order_idx" ON "cms"."_pages_v_blocks_logos_logos" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_logos_logos_parent_id_idx" ON "cms"."_pages_v_blocks_logos_logos" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_logos_logos_image_idx" ON "cms"."_pages_v_blocks_logos_logos" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_logos_order_idx" ON "cms"."_pages_v_blocks_logos" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_logos_parent_id_idx" ON "cms"."_pages_v_blocks_logos" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_logos_path_idx" ON "cms"."_pages_v_blocks_logos" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_stats_items_order_idx" ON "cms"."_pages_v_blocks_stats_items" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_stats_items_parent_id_idx" ON "cms"."_pages_v_blocks_stats_items" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_stats_order_idx" ON "cms"."_pages_v_blocks_stats" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_stats_parent_id_idx" ON "cms"."_pages_v_blocks_stats" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_stats_path_idx" ON "cms"."_pages_v_blocks_stats" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_cta_buttons_order_idx" ON "cms"."_pages_v_blocks_cta_buttons" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_cta_buttons_parent_id_idx" ON "cms"."_pages_v_blocks_cta_buttons" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_cta_order_idx" ON "cms"."_pages_v_blocks_cta" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_cta_parent_id_idx" ON "cms"."_pages_v_blocks_cta" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_cta_path_idx" ON "cms"."_pages_v_blocks_cta" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_faq_items_order_idx" ON "cms"."_pages_v_blocks_faq_items" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_faq_items_parent_id_idx" ON "cms"."_pages_v_blocks_faq_items" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_faq_order_idx" ON "cms"."_pages_v_blocks_faq" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_faq_parent_id_idx" ON "cms"."_pages_v_blocks_faq" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_faq_path_idx" ON "cms"."_pages_v_blocks_faq" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_prose_order_idx" ON "cms"."_pages_v_blocks_prose" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_prose_parent_id_idx" ON "cms"."_pages_v_blocks_prose" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_prose_path_idx" ON "cms"."_pages_v_blocks_prose" USING btree ("_path");
  CREATE INDEX "_pages_v_parent_idx" ON "cms"."_pages_v" USING btree ("parent_id");
  CREATE INDEX "_pages_v_version_version_slug_idx" ON "cms"."_pages_v" USING btree ("version_slug");
  CREATE INDEX "_pages_v_version_meta_version_meta_image_idx" ON "cms"."_pages_v" USING btree ("version_meta_image_id");
  CREATE INDEX "_pages_v_version_version_updated_at_idx" ON "cms"."_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_pages_v_version_version_created_at_idx" ON "cms"."_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_pages_v_version_version__status_idx" ON "cms"."_pages_v" USING btree ("version__status");
  CREATE INDEX "_pages_v_created_at_idx" ON "cms"."_pages_v" USING btree ("created_at");
  CREATE INDEX "_pages_v_updated_at_idx" ON "cms"."_pages_v" USING btree ("updated_at");
  CREATE INDEX "_pages_v_latest_idx" ON "cms"."_pages_v" USING btree ("latest");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "cms"."payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "cms"."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "cms"."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "cms"."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "cms"."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "cms"."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "cms"."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_articles_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("articles_id");
  CREATE INDEX "payload_locked_documents_rels_events_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("events_id");
  CREATE INDEX "payload_locked_documents_rels_videos_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("videos_id");
  CREATE INDEX "payload_locked_documents_rels_audio_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("audio_id");
  CREATE INDEX "payload_locked_documents_rels_photos_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("photos_id");
  CREATE INDEX "payload_locked_documents_rels_locations_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("locations_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_preferences_key_idx" ON "cms"."payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "cms"."payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "cms"."payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "cms"."payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "cms"."payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "cms"."payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "cms"."payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "cms"."payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "cms"."payload_migrations" USING btree ("created_at");
  CREATE INDEX "site_settings_header_submenu_order_idx" ON "cms"."site_settings_header_submenu" USING btree ("_order");
  CREATE INDEX "site_settings_header_submenu_parent_id_idx" ON "cms"."site_settings_header_submenu" USING btree ("_parent_id");
  CREATE INDEX "site_settings_header_order_idx" ON "cms"."site_settings_header" USING btree ("_order");
  CREATE INDEX "site_settings_header_parent_id_idx" ON "cms"."site_settings_header" USING btree ("_parent_id");
  CREATE INDEX "site_settings_header_actions_order_idx" ON "cms"."site_settings_header_actions" USING btree ("_order");
  CREATE INDEX "site_settings_header_actions_parent_id_idx" ON "cms"."site_settings_header_actions" USING btree ("_parent_id");
  CREATE INDEX "site_settings_footer_columns_links_order_idx" ON "cms"."site_settings_footer_columns_links" USING btree ("_order");
  CREATE INDEX "site_settings_footer_columns_links_parent_id_idx" ON "cms"."site_settings_footer_columns_links" USING btree ("_parent_id");
  CREATE INDEX "site_settings_footer_columns_order_idx" ON "cms"."site_settings_footer_columns" USING btree ("_order");
  CREATE INDEX "site_settings_footer_columns_parent_id_idx" ON "cms"."site_settings_footer_columns" USING btree ("_parent_id");
  CREATE INDEX "site_settings_footer_policies_order_idx" ON "cms"."site_settings_footer_policies" USING btree ("_order");
  CREATE INDEX "site_settings_footer_policies_parent_id_idx" ON "cms"."site_settings_footer_policies" USING btree ("_parent_id");
  CREATE INDEX "theme_settings_app_icon_idx" ON "cms"."theme_settings" USING btree ("app_icon_id");
  CREATE INDEX "theme_settings_logo_light_idx" ON "cms"."theme_settings" USING btree ("logo_light_id");
  CREATE INDEX "theme_settings_logo_dark_idx" ON "cms"."theme_settings" USING btree ("logo_dark_id");
  CREATE INDEX "theme_settings__status_idx" ON "cms"."theme_settings" USING btree ("_status");
  CREATE INDEX "_theme_settings_v_version_version_app_icon_idx" ON "cms"."_theme_settings_v" USING btree ("version_app_icon_id");
  CREATE INDEX "_theme_settings_v_version_version_logo_light_idx" ON "cms"."_theme_settings_v" USING btree ("version_logo_light_id");
  CREATE INDEX "_theme_settings_v_version_version_logo_dark_idx" ON "cms"."_theme_settings_v" USING btree ("version_logo_dark_id");
  CREATE INDEX "_theme_settings_v_version_version__status_idx" ON "cms"."_theme_settings_v" USING btree ("version__status");
  CREATE INDEX "_theme_settings_v_created_at_idx" ON "cms"."_theme_settings_v" USING btree ("created_at");
  CREATE INDEX "_theme_settings_v_updated_at_idx" ON "cms"."_theme_settings_v" USING btree ("updated_at");
  CREATE INDEX "_theme_settings_v_latest_idx" ON "cms"."_theme_settings_v" USING btree ("latest");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "cms"."users" CASCADE;
  DROP TABLE "cms"."media" CASCADE;
  DROP TABLE "cms"."articles" CASCADE;
  DROP TABLE "cms"."articles_texts" CASCADE;
  DROP TABLE "cms"."_articles_v" CASCADE;
  DROP TABLE "cms"."_articles_v_texts" CASCADE;
  DROP TABLE "cms"."events" CASCADE;
  DROP TABLE "cms"."_events_v" CASCADE;
  DROP TABLE "cms"."videos" CASCADE;
  DROP TABLE "cms"."_videos_v" CASCADE;
  DROP TABLE "cms"."audio" CASCADE;
  DROP TABLE "cms"."_audio_v" CASCADE;
  DROP TABLE "cms"."photos_gallery" CASCADE;
  DROP TABLE "cms"."photos" CASCADE;
  DROP TABLE "cms"."_photos_v_version_gallery" CASCADE;
  DROP TABLE "cms"."_photos_v" CASCADE;
  DROP TABLE "cms"."locations" CASCADE;
  DROP TABLE "cms"."_locations_v" CASCADE;
  DROP TABLE "cms"."pages_blocks_hero_buttons" CASCADE;
  DROP TABLE "cms"."pages_blocks_hero" CASCADE;
  DROP TABLE "cms"."pages_blocks_items_items" CASCADE;
  DROP TABLE "cms"."pages_blocks_items" CASCADE;
  DROP TABLE "cms"."pages_blocks_logos_logos" CASCADE;
  DROP TABLE "cms"."pages_blocks_logos" CASCADE;
  DROP TABLE "cms"."pages_blocks_stats_items" CASCADE;
  DROP TABLE "cms"."pages_blocks_stats" CASCADE;
  DROP TABLE "cms"."pages_blocks_cta_buttons" CASCADE;
  DROP TABLE "cms"."pages_blocks_cta" CASCADE;
  DROP TABLE "cms"."pages_blocks_faq_items" CASCADE;
  DROP TABLE "cms"."pages_blocks_faq" CASCADE;
  DROP TABLE "cms"."pages_blocks_prose" CASCADE;
  DROP TABLE "cms"."pages" CASCADE;
  DROP TABLE "cms"."_pages_v_blocks_hero_buttons" CASCADE;
  DROP TABLE "cms"."_pages_v_blocks_hero" CASCADE;
  DROP TABLE "cms"."_pages_v_blocks_items_items" CASCADE;
  DROP TABLE "cms"."_pages_v_blocks_items" CASCADE;
  DROP TABLE "cms"."_pages_v_blocks_logos_logos" CASCADE;
  DROP TABLE "cms"."_pages_v_blocks_logos" CASCADE;
  DROP TABLE "cms"."_pages_v_blocks_stats_items" CASCADE;
  DROP TABLE "cms"."_pages_v_blocks_stats" CASCADE;
  DROP TABLE "cms"."_pages_v_blocks_cta_buttons" CASCADE;
  DROP TABLE "cms"."_pages_v_blocks_cta" CASCADE;
  DROP TABLE "cms"."_pages_v_blocks_faq_items" CASCADE;
  DROP TABLE "cms"."_pages_v_blocks_faq" CASCADE;
  DROP TABLE "cms"."_pages_v_blocks_prose" CASCADE;
  DROP TABLE "cms"."_pages_v" CASCADE;
  DROP TABLE "cms"."payload_kv" CASCADE;
  DROP TABLE "cms"."payload_locked_documents" CASCADE;
  DROP TABLE "cms"."payload_locked_documents_rels" CASCADE;
  DROP TABLE "cms"."payload_preferences" CASCADE;
  DROP TABLE "cms"."payload_preferences_rels" CASCADE;
  DROP TABLE "cms"."payload_migrations" CASCADE;
  DROP TABLE "cms"."site_settings_header_submenu" CASCADE;
  DROP TABLE "cms"."site_settings_header" CASCADE;
  DROP TABLE "cms"."site_settings_header_actions" CASCADE;
  DROP TABLE "cms"."site_settings_footer_columns_links" CASCADE;
  DROP TABLE "cms"."site_settings_footer_columns" CASCADE;
  DROP TABLE "cms"."site_settings_footer_policies" CASCADE;
  DROP TABLE "cms"."site_settings" CASCADE;
  DROP TABLE "cms"."theme_settings" CASCADE;
  DROP TABLE "cms"."_theme_settings_v" CASCADE;
  DROP TYPE "cms"."enum_users_role";
  DROP TYPE "cms"."enum_articles_status";
  DROP TYPE "cms"."enum__articles_v_version_status";
  DROP TYPE "cms"."enum_events_status";
  DROP TYPE "cms"."enum__events_v_version_status";
  DROP TYPE "cms"."enum_videos_source_type";
  DROP TYPE "cms"."enum_videos_status";
  DROP TYPE "cms"."enum__videos_v_version_source_type";
  DROP TYPE "cms"."enum__videos_v_version_status";
  DROP TYPE "cms"."enum_audio_status";
  DROP TYPE "cms"."enum__audio_v_version_status";
  DROP TYPE "cms"."enum_photos_status";
  DROP TYPE "cms"."enum__photos_v_version_status";
  DROP TYPE "cms"."enum_locations_status";
  DROP TYPE "cms"."enum__locations_v_version_status";
  DROP TYPE "cms"."enum_pages_blocks_hero_buttons_variant";
  DROP TYPE "cms"."enum_pages_blocks_items_items_icon";
  DROP TYPE "cms"."enum_pages_blocks_cta_buttons_variant";
  DROP TYPE "cms"."enum_pages_status";
  DROP TYPE "cms"."enum__pages_v_blocks_hero_buttons_variant";
  DROP TYPE "cms"."enum__pages_v_blocks_items_items_icon";
  DROP TYPE "cms"."enum__pages_v_blocks_cta_buttons_variant";
  DROP TYPE "cms"."enum__pages_v_version_status";
  DROP TYPE "cms"."enum_site_settings_header_actions_variant";
  DROP TYPE "cms"."enum_theme_settings_font_sans";
  DROP TYPE "cms"."enum_theme_settings_font_serif";
  DROP TYPE "cms"."enum_theme_settings_font_mono";
  DROP TYPE "cms"."enum_theme_settings_status";
  DROP TYPE "cms"."enum__theme_settings_v_version_font_sans";
  DROP TYPE "cms"."enum__theme_settings_v_version_font_serif";
  DROP TYPE "cms"."enum__theme_settings_v_version_font_mono";
  DROP TYPE "cms"."enum__theme_settings_v_version_status";`)
}
