/**
 * Full content-registry restructure. The kit's CMS was redesigned wholesale
 * (articles → posts, roles[] users, audio/photos as upload collections, plus
 * the community/engagement/commerce registry), so this migration DROPS the
 * pre-restructure cms tables and recreates the schema from scratch — the kit
 * ships seed-only, and `pnpm db:reset && pnpm cms:seed` reproduces everything.
 * If you built on the old schema with real content, export it before
 * upgrading; there is intentionally no data-preserving path.
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Tear down the pre-restructure schema (the initial migration's
  // footprint, guarded so a database without it is left untouched).
  await db.execute(sql`
  DO $$ BEGIN
    IF to_regclass('cms.articles') IS NOT NULL THEN
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
      DROP TYPE "cms"."enum__theme_settings_v_version_status";
    END IF;
  END $$;`)

  await db.execute(sql`
   CREATE TYPE "cms"."enum_users_roles" AS ENUM('admin', 'editor', 'author', 'member');
  CREATE TYPE "cms"."enum_users_member_status" AS ENUM('active', 'invited', 'suspended', 'banned');
  CREATE TYPE "cms"."enum_users_profile_visibility" AS ENUM('public', 'members', 'private');
  CREATE TYPE "cms"."enum_users_timezone" AS ENUM('Pacific/Midway', 'Pacific/Niue', 'Pacific/Honolulu', 'Pacific/Rarotonga', 'America/Anchorage', 'Pacific/Gambier', 'America/Los_Angeles', 'America/Tijuana', 'America/Denver', 'America/Phoenix', 'America/Chicago', 'America/Guatemala', 'America/New_York', 'America/Bogota', 'America/Caracas', 'America/Santiago', 'America/Buenos_Aires', 'America/Sao_Paulo', 'Atlantic/South_Georgia', 'Atlantic/Azores', 'Atlantic/Cape_Verde', 'Europe/London', 'Europe/Berlin', 'Africa/Lagos', 'Europe/Athens', 'Africa/Cairo', 'Europe/Moscow', 'Asia/Riyadh', 'Asia/Dubai', 'Asia/Baku', 'Asia/Karachi', 'Asia/Tashkent', 'Asia/Calcutta', 'Asia/Dhaka', 'Asia/Almaty', 'Asia/Jakarta', 'Asia/Bangkok', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Seoul', 'Australia/Brisbane', 'Australia/Sydney', 'Pacific/Guam', 'Pacific/Noumea', 'Pacific/Auckland', 'Pacific/Fiji');
  CREATE TYPE "cms"."enum_users_preferred_language" AS ENUM('en', 'es', 'fr', 'de', 'pt', 'it', 'ja', 'ko', 'zh');
  CREATE TYPE "cms"."enum_users_notification_preferences_email_digest" AS ENUM('off', 'daily', 'weekly');
  CREATE TYPE "cms"."enum_device_tokens_platform" AS ENUM('ios', 'android', 'web');
  CREATE TYPE "cms"."enum_enrollments_status" AS ENUM('active', 'completed', 'refunded', 'expired');
  CREATE TYPE "cms"."enum_enrollments_source" AS ENUM('purchase', 'subscription', 'free', 'manual');
  CREATE TYPE "cms"."enum_reviews_status" AS ENUM('pending', 'approved', 'rejected');
  CREATE TYPE "cms"."enum_posts_access_level" AS ENUM('public', 'members', 'premium');
  CREATE TYPE "cms"."enum_posts_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__posts_v_version_access_level" AS ENUM('public', 'members', 'premium');
  CREATE TYPE "cms"."enum__posts_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_videos_captions_language" AS ENUM('en', 'es', 'fr', 'de', 'pt', 'it', 'ja', 'ko', 'zh');
  CREATE TYPE "cms"."enum_videos_orientation" AS ENUM('landscape', 'vertical');
  CREATE TYPE "cms"."enum_videos_aspect_ratio" AS ENUM('16:9', '9:16', '1:1', '4:5');
  CREATE TYPE "cms"."enum_videos_source_type" AS ENUM('url', 'upload', 'mux', 'youtube', 'vimeo');
  CREATE TYPE "cms"."enum_videos_access_level" AS ENUM('public', 'members', 'premium');
  CREATE TYPE "cms"."enum_videos_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__videos_v_version_captions_language" AS ENUM('en', 'es', 'fr', 'de', 'pt', 'it', 'ja', 'ko', 'zh');
  CREATE TYPE "cms"."enum__videos_v_version_orientation" AS ENUM('landscape', 'vertical');
  CREATE TYPE "cms"."enum__videos_v_version_aspect_ratio" AS ENUM('16:9', '9:16', '1:1', '4:5');
  CREATE TYPE "cms"."enum__videos_v_version_source_type" AS ENUM('url', 'upload', 'mux', 'youtube', 'vimeo');
  CREATE TYPE "cms"."enum__videos_v_version_access_level" AS ENUM('public', 'members', 'premium');
  CREATE TYPE "cms"."enum__videos_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_audio_episode_type" AS ENUM('full', 'trailer', 'bonus');
  CREATE TYPE "cms"."enum_audio_access_level" AS ENUM('public', 'members', 'premium');
  CREATE TYPE "cms"."enum_photos_access_level" AS ENUM('public', 'members', 'premium');
  CREATE TYPE "cms"."enum_series_kind" AS ENUM('series', 'season', 'playlist', 'album', 'podcast', 'course');
  CREATE TYPE "cms"."enum_series_access_level" AS ENUM('public', 'members', 'premium');
  CREATE TYPE "cms"."enum_series_podcast_category" AS ENUM('arts', 'business', 'comedy', 'education', 'fiction', 'government', 'health_fitness', 'history', 'kids_family', 'leisure', 'music', 'news', 'religion_spirituality', 'science', 'society_culture', 'sports', 'tv_film', 'technology', 'true_crime');
  CREATE TYPE "cms"."enum_series_podcast_subcategory" AS ENUM('arts', 'business', 'comedy', 'education', 'fiction', 'government', 'health_fitness', 'history', 'kids_family', 'leisure', 'music', 'news', 'religion_spirituality', 'science', 'society_culture', 'sports', 'tv_film', 'technology', 'true_crime');
  CREATE TYPE "cms"."enum_series_podcast_type" AS ENUM('episodic', 'serial');
  CREATE TYPE "cms"."enum_series_course_drip_anchor" AS ENUM('enrollment', 'fixed_date');
  CREATE TYPE "cms"."enum_series_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__series_v_version_kind" AS ENUM('series', 'season', 'playlist', 'album', 'podcast', 'course');
  CREATE TYPE "cms"."enum__series_v_version_access_level" AS ENUM('public', 'members', 'premium');
  CREATE TYPE "cms"."enum__series_v_version_podcast_category" AS ENUM('arts', 'business', 'comedy', 'education', 'fiction', 'government', 'health_fitness', 'history', 'kids_family', 'leisure', 'music', 'news', 'religion_spirituality', 'science', 'society_culture', 'sports', 'tv_film', 'technology', 'true_crime');
  CREATE TYPE "cms"."enum__series_v_version_podcast_subcategory" AS ENUM('arts', 'business', 'comedy', 'education', 'fiction', 'government', 'health_fitness', 'history', 'kids_family', 'leisure', 'music', 'news', 'religion_spirituality', 'science', 'society_culture', 'sports', 'tv_film', 'technology', 'true_crime');
  CREATE TYPE "cms"."enum__series_v_version_podcast_type" AS ENUM('episodic', 'serial');
  CREATE TYPE "cms"."enum__series_v_version_course_drip_anchor" AS ENUM('enrollment', 'fixed_date');
  CREATE TYPE "cms"."enum__series_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_lessons_drip_type" AS ENUM('none', 'scheduled', 'relative');
  CREATE TYPE "cms"."enum_lessons_drip_mode" AS ENUM('gate_content', 'notify_only');
  CREATE TYPE "cms"."enum_lessons_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__lessons_v_version_drip_type" AS ENUM('none', 'scheduled', 'relative');
  CREATE TYPE "cms"."enum__lessons_v_version_drip_mode" AS ENUM('gate_content', 'notify_only');
  CREATE TYPE "cms"."enum__lessons_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_locations_hours_day" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
  CREATE TYPE "cms"."enum_locations_amenities" AS ENUM('wifi', 'parking', 'accessible', 'pets', 'outdoor_seating', 'restrooms', 'food', 'drinks');
  CREATE TYPE "cms"."enum_locations_price_range" AS ENUM('$', '$$', '$$$', '$$$$');
  CREATE TYPE "cms"."enum_locations_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__locations_v_version_hours_day" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
  CREATE TYPE "cms"."enum__locations_v_version_amenities" AS ENUM('wifi', 'parking', 'accessible', 'pets', 'outdoor_seating', 'restrooms', 'food', 'drinks');
  CREATE TYPE "cms"."enum__locations_v_version_price_range" AS ENUM('$', '$$', '$$$', '$$$$');
  CREATE TYPE "cms"."enum__locations_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_events_timezone" AS ENUM('Pacific/Midway', 'Pacific/Niue', 'Pacific/Honolulu', 'Pacific/Rarotonga', 'America/Anchorage', 'Pacific/Gambier', 'America/Los_Angeles', 'America/Tijuana', 'America/Denver', 'America/Phoenix', 'America/Chicago', 'America/Guatemala', 'America/New_York', 'America/Bogota', 'America/Caracas', 'America/Santiago', 'America/Buenos_Aires', 'America/Sao_Paulo', 'Atlantic/South_Georgia', 'Atlantic/Azores', 'Atlantic/Cape_Verde', 'Europe/London', 'Europe/Berlin', 'Africa/Lagos', 'Europe/Athens', 'Africa/Cairo', 'Europe/Moscow', 'Asia/Riyadh', 'Asia/Dubai', 'Asia/Baku', 'Asia/Karachi', 'Asia/Tashkent', 'Asia/Calcutta', 'Asia/Dhaka', 'Asia/Almaty', 'Asia/Jakarta', 'Asia/Bangkok', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Seoul', 'Australia/Brisbane', 'Australia/Sydney', 'Pacific/Guam', 'Pacific/Noumea', 'Pacific/Auckland', 'Pacific/Fiji');
  CREATE TYPE "cms"."enum_events_recurrence_frequency" AS ENUM('daily', 'weekly', 'monthly', 'yearly');
  CREATE TYPE "cms"."enum_events_currency" AS ENUM('usd', 'eur', 'gbp', 'cad', 'aud');
  CREATE TYPE "cms"."enum_events_event_status" AS ENUM('scheduled', 'rescheduled', 'cancelled', 'sold_out');
  CREATE TYPE "cms"."enum_events_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__events_v_version_timezone" AS ENUM('Pacific/Midway', 'Pacific/Niue', 'Pacific/Honolulu', 'Pacific/Rarotonga', 'America/Anchorage', 'Pacific/Gambier', 'America/Los_Angeles', 'America/Tijuana', 'America/Denver', 'America/Phoenix', 'America/Chicago', 'America/Guatemala', 'America/New_York', 'America/Bogota', 'America/Caracas', 'America/Santiago', 'America/Buenos_Aires', 'America/Sao_Paulo', 'Atlantic/South_Georgia', 'Atlantic/Azores', 'Atlantic/Cape_Verde', 'Europe/London', 'Europe/Berlin', 'Africa/Lagos', 'Europe/Athens', 'Africa/Cairo', 'Europe/Moscow', 'Asia/Riyadh', 'Asia/Dubai', 'Asia/Baku', 'Asia/Karachi', 'Asia/Tashkent', 'Asia/Calcutta', 'Asia/Dhaka', 'Asia/Almaty', 'Asia/Jakarta', 'Asia/Bangkok', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Seoul', 'Australia/Brisbane', 'Australia/Sydney', 'Pacific/Guam', 'Pacific/Noumea', 'Pacific/Auckland', 'Pacific/Fiji');
  CREATE TYPE "cms"."enum__events_v_version_recurrence_frequency" AS ENUM('daily', 'weekly', 'monthly', 'yearly');
  CREATE TYPE "cms"."enum__events_v_version_currency" AS ENUM('usd', 'eur', 'gbp', 'cad', 'aud');
  CREATE TYPE "cms"."enum__events_v_version_event_status" AS ENUM('scheduled', 'rescheduled', 'cancelled', 'sold_out');
  CREATE TYPE "cms"."enum__events_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_space_groups_access_level" AS ENUM('public', 'members', 'premium');
  CREATE TYPE "cms"."enum_community_spaces_access_level" AS ENUM('public', 'members', 'premium');
  CREATE TYPE "cms"."enum_community_spaces_posting_policy" AS ENUM('members', 'moderators', 'admins');
  CREATE TYPE "cms"."enum_community_posts_link_type" AS ENUM('page', 'appScreen', 'url');
  CREATE TYPE "cms"."enum_community_posts_access_level" AS ENUM('public', 'members', 'premium');
  CREATE TYPE "cms"."enum_community_posts_status" AS ENUM('published', 'pending', 'hidden', 'flagged');
  CREATE TYPE "cms"."enum_comments_status" AS ENUM('pending', 'approved', 'spam');
  CREATE TYPE "cms"."enum_reports_reason" AS ENUM('spam', 'harassment', 'hate', 'nudity', 'violence', 'misinformation', 'other');
  CREATE TYPE "cms"."enum_reports_status" AS ENUM('open', 'reviewing', 'actioned', 'dismissed');
  CREATE TYPE "cms"."enum_reports_resolution" AS ENUM('none', 'hidden', 'deleted', 'warned', 'banned');
  CREATE TYPE "cms"."enum_plans_pricing_type" AS ENUM('recurring', 'one_time');
  CREATE TYPE "cms"."enum_plans_interval" AS ENUM('day', 'week', 'month', 'year');
  CREATE TYPE "cms"."enum_plans_intro_offer_intro_interval" AS ENUM('month', 'year');
  CREATE TYPE "cms"."enum_plans_entitlement" AS ENUM('members', 'premium');
  CREATE TYPE "cms"."enum_plans_sync_status" AS ENUM('unsynced', 'synced', 'error');
  CREATE TYPE "cms"."enum_coupons_discount_type" AS ENUM('percent_off', 'amount_off');
  CREATE TYPE "cms"."enum_coupons_duration" AS ENUM('once', 'repeating', 'forever');
  CREATE TYPE "cms"."enum_coupons_duration_unit" AS ENUM('month', 'year');
  CREATE TYPE "cms"."enum_coupons_sync_status" AS ENUM('unsynced', 'synced', 'error');
  CREATE TYPE "cms"."enum_subscriptions_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'churned', 'paused');
  CREATE TYPE "cms"."enum_pages_blocks_hero_buttons_variant" AS ENUM('default', 'glow', 'outline', 'secondary');
  CREATE TYPE "cms"."enum_pages_blocks_items_items_icon" AS ENUM('Rocket', 'Zap', 'ShieldCheck', 'Sparkles', 'Star', 'Heart', 'Globe', 'Code', 'Layers', 'Smartphone', 'Palette', 'Lock', 'Check', 'Cloud', 'Bell', 'Settings', 'Users', 'ChartBar', 'Search', 'Mail');
  CREATE TYPE "cms"."enum_pages_blocks_cta_buttons_variant" AS ENUM('default', 'glow', 'outline', 'secondary');
  CREATE TYPE "cms"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__pages_v_blocks_hero_buttons_variant" AS ENUM('default', 'glow', 'outline', 'secondary');
  CREATE TYPE "cms"."enum__pages_v_blocks_items_items_icon" AS ENUM('Rocket', 'Zap', 'ShieldCheck', 'Sparkles', 'Star', 'Heart', 'Globe', 'Code', 'Layers', 'Smartphone', 'Palette', 'Lock', 'Check', 'Cloud', 'Bell', 'Settings', 'Users', 'ChartBar', 'Search', 'Mail');
  CREATE TYPE "cms"."enum__pages_v_blocks_cta_buttons_variant" AS ENUM('default', 'glow', 'outline', 'secondary');
  CREATE TYPE "cms"."enum__pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_onboarding_cta_destination_type" AS ENUM('page', 'appScreen', 'url');
  CREATE TYPE "cms"."enum_onboarding_secondary_cta_destination_type" AS ENUM('page', 'appScreen', 'url');
  CREATE TYPE "cms"."enum_banners_target_platform" AS ENUM('ios', 'android', 'web');
  CREATE TYPE "cms"."enum_banners_variant" AS ENUM('info', 'promo', 'warning', 'announcement');
  CREATE TYPE "cms"."enum_banners_link_appearance" AS ENUM('default', 'button', 'outline', 'link');
  CREATE TYPE "cms"."enum_banners_placement" AS ENUM('home', 'global', 'content', 'onboarding');
  CREATE TYPE "cms"."enum_banners_audience" AS ENUM('all', 'guests', 'members');
  CREATE TYPE "cms"."enum_notifications_channel" AS ENUM('push', 'email', 'sms', 'in_app');
  CREATE TYPE "cms"."enum_notifications_audience" AS ENUM('all', 'segment', 'users');
  CREATE TYPE "cms"."enum_notifications_status" AS ENUM('draft', 'scheduled', 'sending', 'sent', 'failed');
  CREATE TYPE "cms"."enum_forms_confirmation_type" AS ENUM('message', 'redirect');
  CREATE TYPE "cms"."enum_forms_redirect_type" AS ENUM('reference', 'custom');
  CREATE TYPE "cms"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'schedulePublish');
  CREATE TYPE "cms"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "cms"."enum_payload_jobs_task_slug" AS ENUM('inline', 'schedulePublish');
  CREATE TYPE "cms"."enum_payload_folders_folder_type" AS ENUM('media', 'posts', 'videos', 'audio', 'photos', 'series', 'lessons', 'locations', 'events');
  CREATE TYPE "cms"."enum_site_settings_header_actions_variant" AS ENUM('default', 'glow', 'outline', 'secondary');
  CREATE TYPE "cms"."enum_theme_settings_font_sans" AS ENUM('geist', 'inter', 'system');
  CREATE TYPE "cms"."enum_theme_settings_font_serif" AS ENUM('merriweather', 'lora', 'system');
  CREATE TYPE "cms"."enum_theme_settings_font_mono" AS ENUM('geist-mono', 'jetbrains-mono');
  CREATE TYPE "cms"."enum_theme_settings_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__theme_settings_v_version_font_sans" AS ENUM('geist', 'inter', 'system');
  CREATE TYPE "cms"."enum__theme_settings_v_version_font_serif" AS ENUM('merriweather', 'lora', 'system');
  CREATE TYPE "cms"."enum__theme_settings_v_version_font_mono" AS ENUM('geist-mono', 'jetbrains-mono');
  CREATE TYPE "cms"."enum__theme_settings_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_profile_fields_fields_type" AS ENUM('text', 'textarea', 'number', 'select', 'multiselect', 'checkbox', 'date', 'url');
  CREATE TYPE "cms"."enum_profile_fields_fields_visibility" AS ENUM('public', 'members', 'private', 'admin');
  CREATE TABLE "cms"."users_roles" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum_users_roles",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar,
  	"name" varchar,
  	"display_name" varchar,
  	"supabase_user_id" varchar,
  	"member_status" "cms"."enum_users_member_status" DEFAULT 'active',
  	"username" varchar,
  	"first_name" varchar,
  	"last_name" varchar,
  	"pronouns" varchar,
  	"avatar_id" integer,
  	"cover_image_id" integer,
  	"headline" varchar,
  	"bio" varchar,
  	"location" varchar,
  	"website" varchar,
  	"company" varchar,
  	"job_title" varchar,
  	"social_links_twitter" varchar,
  	"social_links_instagram" varchar,
  	"social_links_linkedin" varchar,
  	"social_links_facebook" varchar,
  	"social_links_youtube" varchar,
  	"social_links_tiktok" varchar,
  	"social_links_github" varchar,
  	"profile_visibility" "cms"."enum_users_profile_visibility" DEFAULT 'members',
  	"referral_source" varchar,
  	"custom_fields" jsonb,
  	"phone" varchar,
  	"date_of_birth" timestamp(3) with time zone,
  	"timezone" "cms"."enum_users_timezone",
  	"preferred_language" "cms"."enum_users_preferred_language",
  	"address_street" varchar,
  	"address_city" varchar,
  	"address_region" varchar,
  	"address_postal_code" varchar,
  	"address_country" varchar,
  	"push_enabled" boolean DEFAULT false,
  	"sms_opt_in" boolean DEFAULT false,
  	"marketing_opt_in" boolean DEFAULT false,
  	"notification_preferences_email_digest" "cms"."enum_users_notification_preferences_email_digest" DEFAULT 'off',
  	"notification_preferences_community_replies" boolean DEFAULT true,
  	"notification_preferences_mentions" boolean DEFAULT true,
  	"notification_preferences_direct_messages" boolean DEFAULT true,
  	"notification_preferences_product_updates" boolean DEFAULT false,
  	"onboarding_completed" boolean DEFAULT false,
  	"last_active_at" timestamp(3) with time zone,
  	"stripe_customer_i_d" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "cms"."users_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tags_id" integer
  );
  
  CREATE TABLE "cms"."device_tokens" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"token" varchar NOT NULL,
  	"platform" "cms"."enum_device_tokens_platform" NOT NULL,
  	"device_model" varchar,
  	"app_version" varchar,
  	"os_version" varchar,
  	"locale" varchar,
  	"push_enabled" boolean DEFAULT true,
  	"last_seen_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."feed_tokens" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"token" varchar NOT NULL,
  	"user_id" integer NOT NULL,
  	"show_id" integer,
  	"revoked" boolean DEFAULT false,
  	"last_accessed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
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
  
  CREATE TABLE "cms"."enrollments_progress" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"lesson_id" integer NOT NULL,
  	"completed_at" timestamp(3) with time zone,
  	"percent" numeric
  );
  
  CREATE TABLE "cms"."enrollments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"course_id" integer NOT NULL,
  	"enrolled_at" timestamp(3) with time zone NOT NULL,
  	"status" "cms"."enum_enrollments_status" DEFAULT 'active' NOT NULL,
  	"source" "cms"."enum_enrollments_source" DEFAULT 'manual',
  	"subscription_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."reviews" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"author_id" integer NOT NULL,
  	"rating" numeric NOT NULL,
  	"title" varchar,
  	"body" varchar,
  	"status" "cms"."enum_reviews_status" DEFAULT 'pending' NOT NULL,
  	"helpful_count" numeric DEFAULT 0,
  	"verified_visit" boolean DEFAULT false,
  	"response_body" varchar,
  	"response_responded_by_id" integer,
  	"response_responded_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "cms"."reviews_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"locations_id" integer,
  	"events_id" integer,
  	"media_id" integer
  );
  
  CREATE TABLE "cms"."media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"caption" varchar,
  	"credit" varchar,
  	"blur_data_u_r_l" varchar,
  	"folder_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
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
  
  CREATE TABLE "cms"."media_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tags_id" integer
  );
  
  CREATE TABLE "cms"."posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"excerpt" varchar,
  	"body" jsonb,
  	"featured_image_id" integer,
  	"card_image_id" integer,
  	"author_id" integer,
  	"access_level" "cms"."enum_posts_access_level" DEFAULT 'public',
  	"featured" boolean DEFAULT false,
  	"comments_enabled" boolean DEFAULT false,
  	"published_at" timestamp(3) with time zone,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"folder_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"_status" "cms"."enum_posts_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."posts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer,
  	"users_id" integer,
  	"categories_id" integer,
  	"tags_id" integer,
  	"posts_id" integer
  );
  
  CREATE TABLE "cms"."_posts_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_excerpt" varchar,
  	"version_body" jsonb,
  	"version_featured_image_id" integer,
  	"version_card_image_id" integer,
  	"version_author_id" integer,
  	"version_access_level" "cms"."enum__posts_v_version_access_level" DEFAULT 'public',
  	"version_featured" boolean DEFAULT false,
  	"version_comments_enabled" boolean DEFAULT false,
  	"version_published_at" timestamp(3) with time zone,
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_meta_image_id" integer,
  	"version_folder_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__posts_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."_posts_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer,
  	"users_id" integer,
  	"categories_id" integer,
  	"tags_id" integer,
  	"posts_id" integer
  );
  
  CREATE TABLE "cms"."videos_captions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"language" "cms"."enum_videos_captions_language",
  	"file_id" integer
  );
  
  CREATE TABLE "cms"."videos_chapters" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"start_time" numeric
  );
  
  CREATE TABLE "cms"."videos" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"description" varchar,
  	"body" jsonb,
  	"orientation" "cms"."enum_videos_orientation" DEFAULT 'landscape',
  	"aspect_ratio" "cms"."enum_videos_aspect_ratio",
  	"source_type" "cms"."enum_videos_source_type" DEFAULT 'url',
  	"url" varchar,
  	"video_file_id" integer,
  	"thumbnail_id" integer,
  	"vertical_thumbnail_id" integer,
  	"preview_clip_id" integer,
  	"duration" numeric,
  	"series_id" integer,
  	"episode_number" numeric,
  	"season_number" numeric,
  	"access_level" "cms"."enum_videos_access_level" DEFAULT 'public',
  	"featured" boolean DEFAULT false,
  	"comments_enabled" boolean DEFAULT false,
  	"published_at" timestamp(3) with time zone,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"folder_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"_status" "cms"."enum_videos_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."videos_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer,
  	"tags_id" integer
  );
  
  CREATE TABLE "cms"."_videos_v_version_captions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"language" "cms"."enum__videos_v_version_captions_language",
  	"file_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "cms"."_videos_v_version_chapters" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"start_time" numeric,
  	"_uuid" varchar
  );
  
  CREATE TABLE "cms"."_videos_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_description" varchar,
  	"version_body" jsonb,
  	"version_orientation" "cms"."enum__videos_v_version_orientation" DEFAULT 'landscape',
  	"version_aspect_ratio" "cms"."enum__videos_v_version_aspect_ratio",
  	"version_source_type" "cms"."enum__videos_v_version_source_type" DEFAULT 'url',
  	"version_url" varchar,
  	"version_video_file_id" integer,
  	"version_thumbnail_id" integer,
  	"version_vertical_thumbnail_id" integer,
  	"version_preview_clip_id" integer,
  	"version_duration" numeric,
  	"version_series_id" integer,
  	"version_episode_number" numeric,
  	"version_season_number" numeric,
  	"version_access_level" "cms"."enum__videos_v_version_access_level" DEFAULT 'public',
  	"version_featured" boolean DEFAULT false,
  	"version_comments_enabled" boolean DEFAULT false,
  	"version_published_at" timestamp(3) with time zone,
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_meta_image_id" integer,
  	"version_folder_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__videos_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."_videos_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer,
  	"tags_id" integer
  );
  
  CREATE TABLE "cms"."audio_chapters" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"start_time" numeric NOT NULL
  );
  
  CREATE TABLE "cms"."audio_soundbites" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_time" numeric NOT NULL,
  	"duration" numeric NOT NULL,
  	"title" varchar
  );
  
  CREATE TABLE "cms"."audio" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"guid" varchar,
  	"subtitle" varchar,
  	"description" varchar,
  	"body" jsonb,
  	"cover_art_id" integer,
  	"duration" numeric,
  	"episode_number" numeric,
  	"season_number" numeric,
  	"episode_type" "cms"."enum_audio_episode_type" DEFAULT 'full',
  	"explicit" boolean DEFAULT false,
  	"transcript" jsonb,
  	"transcript_file_id" integer,
  	"series_id" integer,
  	"itunes_block" boolean DEFAULT false,
  	"access_level" "cms"."enum_audio_access_level" DEFAULT 'public',
  	"featured" boolean DEFAULT false,
  	"comments_enabled" boolean DEFAULT false,
  	"published_at" timestamp(3) with time zone,
  	"prefix" varchar DEFAULT 'audio',
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"folder_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "cms"."audio_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer,
  	"tags_id" integer
  );
  
  CREATE TABLE "cms"."photos" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"caption" varchar,
  	"alt_text" varchar,
  	"credit" varchar,
  	"taken_at" timestamp(3) with time zone,
  	"location_id" integer,
  	"album_id" integer,
  	"access_level" "cms"."enum_photos_access_level" DEFAULT 'public',
  	"featured" boolean DEFAULT false,
  	"comments_enabled" boolean DEFAULT false,
  	"published_at" timestamp(3) with time zone,
  	"prefix" varchar DEFAULT 'photos',
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"folder_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
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
  
  CREATE TABLE "cms"."photos_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer,
  	"tags_id" integer
  );
  
  CREATE TABLE "cms"."series_podcast_funding" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar,
  	"label" varchar
  );
  
  CREATE TABLE "cms"."series" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"kind" "cms"."enum_series_kind" DEFAULT 'series',
  	"description" jsonb,
  	"cover_art_id" integer,
  	"featured_image_id" integer,
  	"parent_series_id" integer,
  	"access_level" "cms"."enum_series_access_level" DEFAULT 'public',
  	"display_order" numeric,
  	"featured" boolean DEFAULT false,
  	"podcast_itunes_author" varchar,
  	"podcast_owner_name" varchar,
  	"podcast_owner_email" varchar,
  	"podcast_summary" varchar,
  	"podcast_artwork_id" integer,
  	"podcast_category" "cms"."enum_series_podcast_category",
  	"podcast_subcategory" "cms"."enum_series_podcast_subcategory",
  	"podcast_explicit" boolean DEFAULT false,
  	"podcast_type" "cms"."enum_series_podcast_type" DEFAULT 'episodic',
  	"podcast_language" varchar DEFAULT 'en',
  	"podcast_copyright" varchar,
  	"podcast_link" varchar,
  	"podcast_podcast_guid" varchar,
  	"podcast_locked" boolean DEFAULT false,
  	"podcast_locked_owner" varchar,
  	"podcast_complete" boolean DEFAULT false,
  	"podcast_new_feed_url" varchar,
  	"podcast_is_private" boolean DEFAULT false,
  	"course_summary" varchar,
  	"course_drip_enabled" boolean DEFAULT false,
  	"course_drip_anchor" "cms"."enum_series_course_drip_anchor" DEFAULT 'enrollment',
  	"course_certificate_on_complete" boolean DEFAULT false,
  	"course_estimated_hours" numeric,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"folder_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"_status" "cms"."enum_series_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."series_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer,
  	"tags_id" integer,
  	"plans_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "cms"."_series_v_version_podcast_funding" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"url" varchar,
  	"label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "cms"."_series_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_kind" "cms"."enum__series_v_version_kind" DEFAULT 'series',
  	"version_description" jsonb,
  	"version_cover_art_id" integer,
  	"version_featured_image_id" integer,
  	"version_parent_series_id" integer,
  	"version_access_level" "cms"."enum__series_v_version_access_level" DEFAULT 'public',
  	"version_display_order" numeric,
  	"version_featured" boolean DEFAULT false,
  	"version_podcast_itunes_author" varchar,
  	"version_podcast_owner_name" varchar,
  	"version_podcast_owner_email" varchar,
  	"version_podcast_summary" varchar,
  	"version_podcast_artwork_id" integer,
  	"version_podcast_category" "cms"."enum__series_v_version_podcast_category",
  	"version_podcast_subcategory" "cms"."enum__series_v_version_podcast_subcategory",
  	"version_podcast_explicit" boolean DEFAULT false,
  	"version_podcast_type" "cms"."enum__series_v_version_podcast_type" DEFAULT 'episodic',
  	"version_podcast_language" varchar DEFAULT 'en',
  	"version_podcast_copyright" varchar,
  	"version_podcast_link" varchar,
  	"version_podcast_podcast_guid" varchar,
  	"version_podcast_locked" boolean DEFAULT false,
  	"version_podcast_locked_owner" varchar,
  	"version_podcast_complete" boolean DEFAULT false,
  	"version_podcast_new_feed_url" varchar,
  	"version_podcast_is_private" boolean DEFAULT false,
  	"version_course_summary" varchar,
  	"version_course_drip_enabled" boolean DEFAULT false,
  	"version_course_drip_anchor" "cms"."enum__series_v_version_course_drip_anchor" DEFAULT 'enrollment',
  	"version_course_certificate_on_complete" boolean DEFAULT false,
  	"version_course_estimated_hours" numeric,
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_meta_image_id" integer,
  	"version_folder_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__series_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."_series_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer,
  	"tags_id" integer,
  	"plans_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "cms"."lessons" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"course_id" integer,
  	"module" varchar,
  	"order" numeric,
  	"content" jsonb,
  	"video_id" integer,
  	"audio_id" integer,
  	"duration" numeric,
  	"preview" boolean DEFAULT false,
  	"drip_type" "cms"."enum_lessons_drip_type" DEFAULT 'none',
  	"release_at" timestamp(3) with time zone,
  	"release_after_days" numeric,
  	"drip_mode" "cms"."enum_lessons_drip_mode" DEFAULT 'gate_content',
  	"notify_push" boolean DEFAULT false,
  	"notify_email" boolean DEFAULT false,
  	"folder_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"_status" "cms"."enum_lessons_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."lessons_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "cms"."_lessons_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_course_id" integer,
  	"version_module" varchar,
  	"version_order" numeric,
  	"version_content" jsonb,
  	"version_video_id" integer,
  	"version_audio_id" integer,
  	"version_duration" numeric,
  	"version_preview" boolean DEFAULT false,
  	"version_drip_type" "cms"."enum__lessons_v_version_drip_type" DEFAULT 'none',
  	"version_release_at" timestamp(3) with time zone,
  	"version_release_after_days" numeric,
  	"version_drip_mode" "cms"."enum__lessons_v_version_drip_mode" DEFAULT 'gate_content',
  	"version_notify_push" boolean DEFAULT false,
  	"version_notify_email" boolean DEFAULT false,
  	"version_folder_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__lessons_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."_lessons_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "cms"."locations_hours" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"day" "cms"."enum_locations_hours_day",
  	"opens_at" varchar,
  	"closes_at" varchar,
  	"closed" boolean DEFAULT false
  );
  
  CREATE TABLE "cms"."locations_amenities" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum_locations_amenities",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."locations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"slug" varchar,
  	"short_description" varchar,
  	"description" jsonb,
  	"address_street" varchar,
  	"address_street2" varchar,
  	"address_city" varchar,
  	"address_region" varchar,
  	"address_postal_code" varchar,
  	"address_country" varchar,
  	"coordinates" geometry(Point),
  	"phone" varchar,
  	"email" varchar,
  	"website" varchar,
  	"price_range" "cms"."enum_locations_price_range",
  	"featured_image_id" integer,
  	"location_type_id" integer,
  	"rating_average" numeric,
  	"temporarily_closed" boolean DEFAULT false,
  	"featured" boolean DEFAULT false,
  	"comments_enabled" boolean DEFAULT false,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"folder_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"_status" "cms"."enum_locations_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."locations_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer,
  	"tags_id" integer
  );
  
  CREATE TABLE "cms"."_locations_v_version_hours" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"day" "cms"."enum__locations_v_version_hours_day",
  	"opens_at" varchar,
  	"closes_at" varchar,
  	"closed" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  CREATE TABLE "cms"."_locations_v_version_amenities" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum__locations_v_version_amenities",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."_locations_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar,
  	"version_slug" varchar,
  	"version_short_description" varchar,
  	"version_description" jsonb,
  	"version_address_street" varchar,
  	"version_address_street2" varchar,
  	"version_address_city" varchar,
  	"version_address_region" varchar,
  	"version_address_postal_code" varchar,
  	"version_address_country" varchar,
  	"version_coordinates" geometry(Point),
  	"version_phone" varchar,
  	"version_email" varchar,
  	"version_website" varchar,
  	"version_price_range" "cms"."enum__locations_v_version_price_range",
  	"version_featured_image_id" integer,
  	"version_location_type_id" integer,
  	"version_rating_average" numeric,
  	"version_temporarily_closed" boolean DEFAULT false,
  	"version_featured" boolean DEFAULT false,
  	"version_comments_enabled" boolean DEFAULT false,
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_meta_image_id" integer,
  	"version_folder_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__locations_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."_locations_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer,
  	"tags_id" integer
  );
  
  CREATE TABLE "cms"."events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"short_description" varchar,
  	"description" jsonb,
  	"event_type_id" integer,
  	"starts_at" timestamp(3) with time zone,
  	"ends_at" timestamp(3) with time zone,
  	"all_day" boolean DEFAULT false,
  	"timezone" "cms"."enum_events_timezone",
  	"recurrence_frequency" "cms"."enum_events_recurrence_frequency",
  	"recurrence_interval" numeric,
  	"recurrence_until" timestamp(3) with time zone,
  	"is_virtual" boolean DEFAULT false,
  	"location_id" integer,
  	"virtual_url" varchar,
  	"featured_image_id" integer,
  	"is_free" boolean DEFAULT false,
  	"price" numeric,
  	"currency" "cms"."enum_events_currency",
  	"ticket_url" varchar,
  	"capacity" numeric,
  	"registration_required" boolean DEFAULT false,
  	"organizer_id" integer,
  	"event_status" "cms"."enum_events_event_status" DEFAULT 'scheduled',
  	"featured" boolean DEFAULT false,
  	"comments_enabled" boolean DEFAULT false,
  	"published_at" timestamp(3) with time zone,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"folder_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"_status" "cms"."enum_events_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."events_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "cms"."_events_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_short_description" varchar,
  	"version_description" jsonb,
  	"version_event_type_id" integer,
  	"version_starts_at" timestamp(3) with time zone,
  	"version_ends_at" timestamp(3) with time zone,
  	"version_all_day" boolean DEFAULT false,
  	"version_timezone" "cms"."enum__events_v_version_timezone",
  	"version_recurrence_frequency" "cms"."enum__events_v_version_recurrence_frequency",
  	"version_recurrence_interval" numeric,
  	"version_recurrence_until" timestamp(3) with time zone,
  	"version_is_virtual" boolean DEFAULT false,
  	"version_location_id" integer,
  	"version_virtual_url" varchar,
  	"version_featured_image_id" integer,
  	"version_is_free" boolean DEFAULT false,
  	"version_price" numeric,
  	"version_currency" "cms"."enum__events_v_version_currency",
  	"version_ticket_url" varchar,
  	"version_capacity" numeric,
  	"version_registration_required" boolean DEFAULT false,
  	"version_organizer_id" integer,
  	"version_event_status" "cms"."enum__events_v_version_event_status" DEFAULT 'scheduled',
  	"version_featured" boolean DEFAULT false,
  	"version_comments_enabled" boolean DEFAULT false,
  	"version_published_at" timestamp(3) with time zone,
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_meta_image_id" integer,
  	"version_folder_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__events_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."_events_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "cms"."categories_breadcrumbs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"doc_id" integer,
  	"url" varchar,
  	"label" varchar
  );
  
  CREATE TABLE "cms"."categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"icon" varchar,
  	"color" varchar,
  	"image_id" integer,
  	"featured" boolean DEFAULT false,
  	"display_order" numeric,
  	"parent_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "cms"."tags" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"group_id" integer,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."tag_groups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"display_order" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."space_groups_breadcrumbs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"doc_id" integer,
  	"url" varchar,
  	"label" varchar
  );
  
  CREATE TABLE "cms"."space_groups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"icon" varchar,
  	"access_level" "cms"."enum_space_groups_access_level" DEFAULT 'public',
  	"order" numeric,
  	"parent_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "cms"."space_groups_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"plans_id" integer
  );
  
  CREATE TABLE "cms"."community_spaces" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"space_group_id" integer,
  	"parent_space_id" integer,
  	"description" varchar,
  	"image_id" integer,
  	"access_level" "cms"."enum_community_spaces_access_level" DEFAULT 'public',
  	"posting_policy" "cms"."enum_community_spaces_posting_policy" DEFAULT 'members' NOT NULL,
  	"order" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "cms"."community_spaces_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"plans_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "cms"."community_posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"author_id" integer NOT NULL,
  	"space_id" integer,
  	"title" varchar,
  	"body" jsonb,
  	"link_type" "cms"."enum_community_posts_link_type" DEFAULT 'page',
  	"link_screen" varchar,
  	"link_params" jsonb,
  	"link_url" varchar,
  	"access_level" "cms"."enum_community_posts_access_level" DEFAULT 'public',
  	"comments_enabled" boolean DEFAULT true,
  	"pinned" boolean DEFAULT false,
  	"status" "cms"."enum_community_posts_status" DEFAULT 'published' NOT NULL,
  	"like_count" numeric DEFAULT 0,
  	"comment_count" numeric DEFAULT 0,
  	"report_count" numeric DEFAULT 0,
  	"published_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "cms"."community_posts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer,
  	"pages_id" integer,
  	"posts_id" integer,
  	"videos_id" integer,
  	"audio_id" integer,
  	"series_id" integer,
  	"events_id" integer,
  	"locations_id" integer,
  	"tags_id" integer
  );
  
  CREATE TABLE "cms"."comments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"author_id" integer NOT NULL,
  	"parent_id" integer,
  	"body" varchar NOT NULL,
  	"status" "cms"."enum_comments_status" DEFAULT 'approved' NOT NULL,
  	"like_count" numeric DEFAULT 0,
  	"report_count" numeric DEFAULT 0,
  	"is_pinned" boolean DEFAULT false,
  	"edited_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "cms"."comments_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"community_posts_id" integer,
  	"posts_id" integer,
  	"videos_id" integer,
  	"audio_id" integer,
  	"photos_id" integer,
  	"events_id" integer,
  	"locations_id" integer
  );
  
  CREATE TABLE "cms"."reports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reporter_id" integer NOT NULL,
  	"reason" "cms"."enum_reports_reason" NOT NULL,
  	"details" varchar,
  	"status" "cms"."enum_reports_status" DEFAULT 'open' NOT NULL,
  	"resolution" "cms"."enum_reports_resolution" DEFAULT 'none',
  	"resolved_by_id" integer,
  	"resolved_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."reports_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"community_posts_id" integer,
  	"comments_id" integer
  );
  
  CREATE TABLE "cms"."plans_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL,
  	"included" boolean DEFAULT true
  );
  
  CREATE TABLE "cms"."plans" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"active" boolean DEFAULT true,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"pricing_type" "cms"."enum_plans_pricing_type" DEFAULT 'recurring' NOT NULL,
  	"interval" "cms"."enum_plans_interval" DEFAULT 'month',
  	"interval_count" numeric DEFAULT 1,
  	"unit_amount" numeric NOT NULL,
  	"currency" varchar DEFAULT 'usd' NOT NULL,
  	"trial_days" numeric,
  	"intro_offer_enabled" boolean DEFAULT false,
  	"intro_offer_intro_amount" numeric,
  	"intro_offer_intro_interval" "cms"."enum_plans_intro_offer_intro_interval" DEFAULT 'month',
  	"intro_offer_intro_periods" numeric DEFAULT 1,
  	"entitlement" "cms"."enum_plans_entitlement" DEFAULT 'premium',
  	"badge" varchar,
  	"highlighted" boolean DEFAULT false,
  	"display_order" numeric DEFAULT 0,
  	"skip_sync" boolean DEFAULT false,
  	"stripe_product_id" varchar,
  	"stripe_price_id" varchar,
  	"stripe_intro_coupon_id" varchar,
  	"sync_status" "cms"."enum_plans_sync_status" DEFAULT 'unsynced',
  	"sync_error" varchar,
  	"last_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."coupons" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"discount_type" "cms"."enum_coupons_discount_type" DEFAULT 'percent_off' NOT NULL,
  	"value" numeric NOT NULL,
  	"currency" varchar DEFAULT 'usd',
  	"duration" "cms"."enum_coupons_duration" DEFAULT 'once' NOT NULL,
  	"duration_count" numeric DEFAULT 1,
  	"duration_unit" "cms"."enum_coupons_duration_unit" DEFAULT 'month',
  	"max_redemptions" numeric,
  	"redeem_by" timestamp(3) with time zone,
  	"minimum_amount" numeric,
  	"times_redeemed" numeric DEFAULT 0,
  	"active" boolean DEFAULT true,
  	"code" varchar,
  	"is_welcome_offer" boolean DEFAULT false,
  	"skip_sync" boolean DEFAULT false,
  	"stripe_coupon_id" varchar,
  	"stripe_promotion_code_id" varchar,
  	"sync_status" "cms"."enum_coupons_sync_status" DEFAULT 'unsynced',
  	"sync_error" varchar,
  	"last_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."coupons_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"plans_id" integer
  );
  
  CREATE TABLE "cms"."subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer,
  	"plan_id" integer,
  	"coupon_id" integer,
  	"status" "cms"."enum_subscriptions_status" NOT NULL,
  	"started_at" timestamp(3) with time zone,
  	"trial_ends_at" timestamp(3) with time zone,
  	"current_period_start" timestamp(3) with time zone,
  	"current_period_end" timestamp(3) with time zone,
  	"cancel_at_period_end" boolean DEFAULT false,
  	"canceled_at" timestamp(3) with time zone,
  	"last_payment_at" timestamp(3) with time zone,
  	"last_payment_amount" numeric,
  	"stripe_subscription_i_d" varchar NOT NULL,
  	"stripe_customer_i_d" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
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
  
  CREATE TABLE "cms"."pages_breadcrumbs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"doc_id" integer,
  	"url" varchar,
  	"label" varchar
  );
  
  CREATE TABLE "cms"."pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"show_in_nav" boolean DEFAULT false,
  	"published_at" timestamp(3) with time zone,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"parent_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
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
  
  CREATE TABLE "cms"."_pages_v_version_breadcrumbs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"doc_id" integer,
  	"url" varchar,
  	"label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "cms"."_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_show_in_nav" boolean DEFAULT false,
  	"version_published_at" timestamp(3) with time zone,
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_meta_image_id" integer,
  	"version_parent_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."onboarding" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar,
  	"image_id" integer,
  	"animation_id" integer,
  	"cta_label" varchar,
  	"cta_destination_type" "cms"."enum_onboarding_cta_destination_type" DEFAULT 'page',
  	"cta_destination_screen" varchar,
  	"cta_destination_params" jsonb,
  	"cta_destination_url" varchar,
  	"secondary_cta_label" varchar,
  	"secondary_cta_destination_type" "cms"."enum_onboarding_secondary_cta_destination_type" DEFAULT 'page',
  	"secondary_cta_destination_screen" varchar,
  	"secondary_cta_destination_params" jsonb,
  	"secondary_cta_destination_url" varchar,
  	"is_final_slide" boolean DEFAULT false,
  	"order" numeric DEFAULT 0 NOT NULL,
  	"background_color" varchar,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."onboarding_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pages_id" integer,
  	"posts_id" integer,
  	"videos_id" integer,
  	"audio_id" integer,
  	"series_id" integer,
  	"events_id" integer,
  	"locations_id" integer
  );
  
  CREATE TABLE "cms"."banners_target_platform" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum_banners_target_platform",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."banners" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar,
  	"image_id" integer,
  	"icon" varchar,
  	"variant" "cms"."enum_banners_variant" DEFAULT 'info' NOT NULL,
  	"link_label" varchar,
  	"link_url" varchar,
  	"link_new_tab" boolean DEFAULT false,
  	"link_appearance" "cms"."enum_banners_link_appearance" DEFAULT 'default',
  	"placement" "cms"."enum_banners_placement" DEFAULT 'home' NOT NULL,
  	"audience" "cms"."enum_banners_audience" DEFAULT 'all',
  	"starts_at" timestamp(3) with time zone,
  	"ends_at" timestamp(3) with time zone,
  	"priority" numeric DEFAULT 0,
  	"dismissible" boolean DEFAULT true,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."notifications_channel" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum_notifications_channel",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."notifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar,
  	"image_id" integer,
  	"deep_link" varchar,
  	"data" jsonb,
  	"sms_body" varchar,
  	"audience" "cms"."enum_notifications_audience" DEFAULT 'all' NOT NULL,
  	"segment" jsonb,
  	"scheduled_at" timestamp(3) with time zone,
  	"sent_at" timestamp(3) with time zone,
  	"status" "cms"."enum_notifications_status" DEFAULT 'draft' NOT NULL,
  	"sent_count" numeric DEFAULT 0,
  	"open_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "cms"."notifications_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "cms"."forms_blocks_checkbox" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"label" varchar,
  	"width" numeric,
  	"required" boolean,
  	"default_value" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "cms"."forms_blocks_email" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"label" varchar,
  	"width" numeric,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "cms"."forms_blocks_message" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"message" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "cms"."forms_blocks_number" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"label" varchar,
  	"width" numeric,
  	"default_value" numeric,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "cms"."forms_blocks_select_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "cms"."forms_blocks_select" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"label" varchar,
  	"width" numeric,
  	"default_value" varchar,
  	"placeholder" varchar,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "cms"."forms_blocks_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"label" varchar,
  	"width" numeric,
  	"default_value" varchar,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "cms"."forms_blocks_textarea" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"label" varchar,
  	"width" numeric,
  	"default_value" varchar,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "cms"."forms_emails" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"email_to" varchar,
  	"cc" varchar,
  	"bcc" varchar,
  	"reply_to" varchar,
  	"email_from" varchar,
  	"subject" varchar DEFAULT 'You''ve received a new message.' NOT NULL,
  	"message" jsonb
  );
  
  CREATE TABLE "cms"."forms" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"submit_button_label" varchar,
  	"confirmation_type" "cms"."enum_forms_confirmation_type" DEFAULT 'message',
  	"confirmation_message" jsonb,
  	"redirect_type" "cms"."enum_forms_redirect_type" DEFAULT 'reference',
  	"redirect_url" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."forms_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pages_id" integer
  );
  
  CREATE TABLE "cms"."form_submissions_submission_data" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"field" varchar NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "cms"."form_submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"form_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "cms"."payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "cms"."enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb,
  	"output" jsonb,
  	"state" "cms"."enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb
  );
  
  CREATE TABLE "cms"."payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "cms"."enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."payload_folders_folder_type" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum_payload_folders_folder_type",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."payload_folders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"folder_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
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
  	"device_tokens_id" integer,
  	"feed_tokens_id" integer,
  	"favorites_id" integer,
  	"enrollments_id" integer,
  	"reviews_id" integer,
  	"media_id" integer,
  	"posts_id" integer,
  	"videos_id" integer,
  	"audio_id" integer,
  	"photos_id" integer,
  	"series_id" integer,
  	"lessons_id" integer,
  	"locations_id" integer,
  	"events_id" integer,
  	"categories_id" integer,
  	"tags_id" integer,
  	"tag_groups_id" integer,
  	"space_groups_id" integer,
  	"community_spaces_id" integer,
  	"community_posts_id" integer,
  	"comments_id" integer,
  	"reports_id" integer,
  	"plans_id" integer,
  	"coupons_id" integer,
  	"subscriptions_id" integer,
  	"pages_id" integer,
  	"onboarding_id" integer,
  	"banners_id" integer,
  	"notifications_id" integer,
  	"forms_id" integer,
  	"form_submissions_id" integer,
  	"payload_folders_id" integer
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
  
  CREATE TABLE "cms"."pricing_settings_free_tier_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "cms"."pricing_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'Pricing',
  	"show_free_tier" boolean DEFAULT true,
  	"subheading" varchar DEFAULT 'Start free. Upgrade when you''re ready.',
  	"free_tier_name" varchar DEFAULT 'Free',
  	"free_tier_description" varchar DEFAULT 'Everything you need to get started.',
  	"free_tier_cta_label" varchar DEFAULT 'Get started',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "cms"."pricing_settings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"plans_id" integer
  );
  
  CREATE TABLE "cms"."profile_fields_fields_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"value" varchar
  );
  
  CREATE TABLE "cms"."profile_fields_fields" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"type" "cms"."enum_profile_fields_fields_type" DEFAULT 'text' NOT NULL,
  	"required" boolean DEFAULT false,
  	"visibility" "cms"."enum_profile_fields_fields_visibility" DEFAULT 'members',
  	"editable_by_member" boolean DEFAULT true,
  	"order" numeric DEFAULT 0
  );
  
  CREATE TABLE "cms"."profile_fields" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "cms"."users_roles" ADD CONSTRAINT "users_roles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."users" ADD CONSTRAINT "users_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."users" ADD CONSTRAINT "users_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."users_rels" ADD CONSTRAINT "users_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "cms"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."device_tokens" ADD CONSTRAINT "device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."feed_tokens" ADD CONSTRAINT "feed_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."feed_tokens" ADD CONSTRAINT "feed_tokens_show_id_series_id_fk" FOREIGN KEY ("show_id") REFERENCES "cms"."series"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."favorites_rels" ADD CONSTRAINT "favorites_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."favorites"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."favorites_rels" ADD CONSTRAINT "favorites_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "cms"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."favorites_rels" ADD CONSTRAINT "favorites_rels_videos_fk" FOREIGN KEY ("videos_id") REFERENCES "cms"."videos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."favorites_rels" ADD CONSTRAINT "favorites_rels_audio_fk" FOREIGN KEY ("audio_id") REFERENCES "cms"."audio"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."favorites_rels" ADD CONSTRAINT "favorites_rels_photos_fk" FOREIGN KEY ("photos_id") REFERENCES "cms"."photos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."favorites_rels" ADD CONSTRAINT "favorites_rels_locations_fk" FOREIGN KEY ("locations_id") REFERENCES "cms"."locations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."favorites_rels" ADD CONSTRAINT "favorites_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "cms"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."enrollments_progress" ADD CONSTRAINT "enrollments_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "cms"."lessons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."enrollments_progress" ADD CONSTRAINT "enrollments_progress_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."enrollments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."enrollments" ADD CONSTRAINT "enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."enrollments" ADD CONSTRAINT "enrollments_course_id_series_id_fk" FOREIGN KEY ("course_id") REFERENCES "cms"."series"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."enrollments" ADD CONSTRAINT "enrollments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "cms"."subscriptions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."reviews" ADD CONSTRAINT "reviews_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."reviews" ADD CONSTRAINT "reviews_response_responded_by_id_users_id_fk" FOREIGN KEY ("response_responded_by_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."reviews_rels" ADD CONSTRAINT "reviews_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."reviews_rels" ADD CONSTRAINT "reviews_rels_locations_fk" FOREIGN KEY ("locations_id") REFERENCES "cms"."locations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."reviews_rels" ADD CONSTRAINT "reviews_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "cms"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."reviews_rels" ADD CONSTRAINT "reviews_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "cms"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."media" ADD CONSTRAINT "media_folder_id_payload_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "cms"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."media_rels" ADD CONSTRAINT "media_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."media_rels" ADD CONSTRAINT "media_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "cms"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."posts" ADD CONSTRAINT "posts_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."posts" ADD CONSTRAINT "posts_card_image_id_media_id_fk" FOREIGN KEY ("card_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."posts" ADD CONSTRAINT "posts_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."posts" ADD CONSTRAINT "posts_folder_id_payload_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "cms"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."posts_rels" ADD CONSTRAINT "posts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."posts_rels" ADD CONSTRAINT "posts_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "cms"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."posts_rels" ADD CONSTRAINT "posts_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "cms"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."posts_rels" ADD CONSTRAINT "posts_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "cms"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."posts_rels" ADD CONSTRAINT "posts_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "cms"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."posts_rels" ADD CONSTRAINT "posts_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "cms"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v" ADD CONSTRAINT "_posts_v_parent_id_posts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v" ADD CONSTRAINT "_posts_v_version_featured_image_id_media_id_fk" FOREIGN KEY ("version_featured_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v" ADD CONSTRAINT "_posts_v_version_card_image_id_media_id_fk" FOREIGN KEY ("version_card_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v" ADD CONSTRAINT "_posts_v_version_author_id_users_id_fk" FOREIGN KEY ("version_author_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v" ADD CONSTRAINT "_posts_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v" ADD CONSTRAINT "_posts_v_version_folder_id_payload_folders_id_fk" FOREIGN KEY ("version_folder_id") REFERENCES "cms"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "cms"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "cms"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "cms"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "cms"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "cms"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."videos_captions" ADD CONSTRAINT "videos_captions_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."videos_captions" ADD CONSTRAINT "videos_captions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."videos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."videos_chapters" ADD CONSTRAINT "videos_chapters_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."videos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."videos" ADD CONSTRAINT "videos_video_file_id_media_id_fk" FOREIGN KEY ("video_file_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."videos" ADD CONSTRAINT "videos_thumbnail_id_media_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."videos" ADD CONSTRAINT "videos_vertical_thumbnail_id_media_id_fk" FOREIGN KEY ("vertical_thumbnail_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."videos" ADD CONSTRAINT "videos_preview_clip_id_media_id_fk" FOREIGN KEY ("preview_clip_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."videos" ADD CONSTRAINT "videos_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "cms"."series"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."videos" ADD CONSTRAINT "videos_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."videos" ADD CONSTRAINT "videos_folder_id_payload_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "cms"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."videos_rels" ADD CONSTRAINT "videos_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."videos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."videos_rels" ADD CONSTRAINT "videos_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "cms"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."videos_rels" ADD CONSTRAINT "videos_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "cms"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_videos_v_version_captions" ADD CONSTRAINT "_videos_v_version_captions_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_videos_v_version_captions" ADD CONSTRAINT "_videos_v_version_captions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_videos_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_videos_v_version_chapters" ADD CONSTRAINT "_videos_v_version_chapters_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_videos_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_videos_v" ADD CONSTRAINT "_videos_v_parent_id_videos_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."videos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_videos_v" ADD CONSTRAINT "_videos_v_version_video_file_id_media_id_fk" FOREIGN KEY ("version_video_file_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_videos_v" ADD CONSTRAINT "_videos_v_version_thumbnail_id_media_id_fk" FOREIGN KEY ("version_thumbnail_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_videos_v" ADD CONSTRAINT "_videos_v_version_vertical_thumbnail_id_media_id_fk" FOREIGN KEY ("version_vertical_thumbnail_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_videos_v" ADD CONSTRAINT "_videos_v_version_preview_clip_id_media_id_fk" FOREIGN KEY ("version_preview_clip_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_videos_v" ADD CONSTRAINT "_videos_v_version_series_id_series_id_fk" FOREIGN KEY ("version_series_id") REFERENCES "cms"."series"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_videos_v" ADD CONSTRAINT "_videos_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_videos_v" ADD CONSTRAINT "_videos_v_version_folder_id_payload_folders_id_fk" FOREIGN KEY ("version_folder_id") REFERENCES "cms"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_videos_v_rels" ADD CONSTRAINT "_videos_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_videos_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_videos_v_rels" ADD CONSTRAINT "_videos_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "cms"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_videos_v_rels" ADD CONSTRAINT "_videos_v_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "cms"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."audio_chapters" ADD CONSTRAINT "audio_chapters_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."audio"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."audio_soundbites" ADD CONSTRAINT "audio_soundbites_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."audio"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."audio" ADD CONSTRAINT "audio_cover_art_id_media_id_fk" FOREIGN KEY ("cover_art_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."audio" ADD CONSTRAINT "audio_transcript_file_id_media_id_fk" FOREIGN KEY ("transcript_file_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."audio" ADD CONSTRAINT "audio_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "cms"."series"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."audio" ADD CONSTRAINT "audio_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."audio" ADD CONSTRAINT "audio_folder_id_payload_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "cms"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."audio_rels" ADD CONSTRAINT "audio_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."audio"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."audio_rels" ADD CONSTRAINT "audio_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "cms"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."audio_rels" ADD CONSTRAINT "audio_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "cms"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."photos" ADD CONSTRAINT "photos_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "cms"."locations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."photos" ADD CONSTRAINT "photos_album_id_series_id_fk" FOREIGN KEY ("album_id") REFERENCES "cms"."series"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."photos" ADD CONSTRAINT "photos_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."photos" ADD CONSTRAINT "photos_folder_id_payload_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "cms"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."photos_rels" ADD CONSTRAINT "photos_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."photos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."photos_rels" ADD CONSTRAINT "photos_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "cms"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."photos_rels" ADD CONSTRAINT "photos_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "cms"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."series_podcast_funding" ADD CONSTRAINT "series_podcast_funding_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."series"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."series" ADD CONSTRAINT "series_cover_art_id_media_id_fk" FOREIGN KEY ("cover_art_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."series" ADD CONSTRAINT "series_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."series" ADD CONSTRAINT "series_parent_series_id_series_id_fk" FOREIGN KEY ("parent_series_id") REFERENCES "cms"."series"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."series" ADD CONSTRAINT "series_podcast_artwork_id_media_id_fk" FOREIGN KEY ("podcast_artwork_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."series" ADD CONSTRAINT "series_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."series" ADD CONSTRAINT "series_folder_id_payload_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "cms"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."series_rels" ADD CONSTRAINT "series_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."series"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."series_rels" ADD CONSTRAINT "series_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "cms"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."series_rels" ADD CONSTRAINT "series_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "cms"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."series_rels" ADD CONSTRAINT "series_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "cms"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."series_rels" ADD CONSTRAINT "series_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "cms"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_series_v_version_podcast_funding" ADD CONSTRAINT "_series_v_version_podcast_funding_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_series_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_series_v" ADD CONSTRAINT "_series_v_parent_id_series_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."series"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_series_v" ADD CONSTRAINT "_series_v_version_cover_art_id_media_id_fk" FOREIGN KEY ("version_cover_art_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_series_v" ADD CONSTRAINT "_series_v_version_featured_image_id_media_id_fk" FOREIGN KEY ("version_featured_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_series_v" ADD CONSTRAINT "_series_v_version_parent_series_id_series_id_fk" FOREIGN KEY ("version_parent_series_id") REFERENCES "cms"."series"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_series_v" ADD CONSTRAINT "_series_v_version_podcast_artwork_id_media_id_fk" FOREIGN KEY ("version_podcast_artwork_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_series_v" ADD CONSTRAINT "_series_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_series_v" ADD CONSTRAINT "_series_v_version_folder_id_payload_folders_id_fk" FOREIGN KEY ("version_folder_id") REFERENCES "cms"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_series_v_rels" ADD CONSTRAINT "_series_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_series_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_series_v_rels" ADD CONSTRAINT "_series_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "cms"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_series_v_rels" ADD CONSTRAINT "_series_v_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "cms"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_series_v_rels" ADD CONSTRAINT "_series_v_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "cms"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_series_v_rels" ADD CONSTRAINT "_series_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "cms"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."lessons" ADD CONSTRAINT "lessons_course_id_series_id_fk" FOREIGN KEY ("course_id") REFERENCES "cms"."series"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."lessons" ADD CONSTRAINT "lessons_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "cms"."videos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."lessons" ADD CONSTRAINT "lessons_audio_id_audio_id_fk" FOREIGN KEY ("audio_id") REFERENCES "cms"."audio"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."lessons" ADD CONSTRAINT "lessons_folder_id_payload_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "cms"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."lessons_rels" ADD CONSTRAINT "lessons_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."lessons_rels" ADD CONSTRAINT "lessons_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "cms"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_lessons_v" ADD CONSTRAINT "_lessons_v_parent_id_lessons_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."lessons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_lessons_v" ADD CONSTRAINT "_lessons_v_version_course_id_series_id_fk" FOREIGN KEY ("version_course_id") REFERENCES "cms"."series"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_lessons_v" ADD CONSTRAINT "_lessons_v_version_video_id_videos_id_fk" FOREIGN KEY ("version_video_id") REFERENCES "cms"."videos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_lessons_v" ADD CONSTRAINT "_lessons_v_version_audio_id_audio_id_fk" FOREIGN KEY ("version_audio_id") REFERENCES "cms"."audio"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_lessons_v" ADD CONSTRAINT "_lessons_v_version_folder_id_payload_folders_id_fk" FOREIGN KEY ("version_folder_id") REFERENCES "cms"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_lessons_v_rels" ADD CONSTRAINT "_lessons_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_lessons_v_rels" ADD CONSTRAINT "_lessons_v_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "cms"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."locations_hours" ADD CONSTRAINT "locations_hours_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."locations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."locations_amenities" ADD CONSTRAINT "locations_amenities_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."locations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."locations" ADD CONSTRAINT "locations_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."locations" ADD CONSTRAINT "locations_location_type_id_categories_id_fk" FOREIGN KEY ("location_type_id") REFERENCES "cms"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."locations" ADD CONSTRAINT "locations_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."locations" ADD CONSTRAINT "locations_folder_id_payload_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "cms"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."locations_rels" ADD CONSTRAINT "locations_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."locations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."locations_rels" ADD CONSTRAINT "locations_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "cms"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."locations_rels" ADD CONSTRAINT "locations_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "cms"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_locations_v_version_hours" ADD CONSTRAINT "_locations_v_version_hours_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_locations_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_locations_v_version_amenities" ADD CONSTRAINT "_locations_v_version_amenities_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_locations_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_locations_v" ADD CONSTRAINT "_locations_v_parent_id_locations_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."locations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_locations_v" ADD CONSTRAINT "_locations_v_version_featured_image_id_media_id_fk" FOREIGN KEY ("version_featured_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_locations_v" ADD CONSTRAINT "_locations_v_version_location_type_id_categories_id_fk" FOREIGN KEY ("version_location_type_id") REFERENCES "cms"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_locations_v" ADD CONSTRAINT "_locations_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_locations_v" ADD CONSTRAINT "_locations_v_version_folder_id_payload_folders_id_fk" FOREIGN KEY ("version_folder_id") REFERENCES "cms"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_locations_v_rels" ADD CONSTRAINT "_locations_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_locations_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_locations_v_rels" ADD CONSTRAINT "_locations_v_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "cms"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_locations_v_rels" ADD CONSTRAINT "_locations_v_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "cms"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."events" ADD CONSTRAINT "events_event_type_id_categories_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "cms"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."events" ADD CONSTRAINT "events_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "cms"."locations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."events" ADD CONSTRAINT "events_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."events" ADD CONSTRAINT "events_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."events" ADD CONSTRAINT "events_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."events" ADD CONSTRAINT "events_folder_id_payload_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "cms"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."events_rels" ADD CONSTRAINT "events_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."events_rels" ADD CONSTRAINT "events_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "cms"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."events_rels" ADD CONSTRAINT "events_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "cms"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_events_v" ADD CONSTRAINT "_events_v_parent_id_events_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_events_v" ADD CONSTRAINT "_events_v_version_event_type_id_categories_id_fk" FOREIGN KEY ("version_event_type_id") REFERENCES "cms"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_events_v" ADD CONSTRAINT "_events_v_version_location_id_locations_id_fk" FOREIGN KEY ("version_location_id") REFERENCES "cms"."locations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_events_v" ADD CONSTRAINT "_events_v_version_featured_image_id_media_id_fk" FOREIGN KEY ("version_featured_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_events_v" ADD CONSTRAINT "_events_v_version_organizer_id_users_id_fk" FOREIGN KEY ("version_organizer_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_events_v" ADD CONSTRAINT "_events_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_events_v" ADD CONSTRAINT "_events_v_version_folder_id_payload_folders_id_fk" FOREIGN KEY ("version_folder_id") REFERENCES "cms"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_events_v_rels" ADD CONSTRAINT "_events_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_events_v_rels" ADD CONSTRAINT "_events_v_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "cms"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_events_v_rels" ADD CONSTRAINT "_events_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "cms"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."categories_breadcrumbs" ADD CONSTRAINT "categories_breadcrumbs_doc_id_categories_id_fk" FOREIGN KEY ("doc_id") REFERENCES "cms"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."categories_breadcrumbs" ADD CONSTRAINT "categories_breadcrumbs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."categories" ADD CONSTRAINT "categories_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."tags" ADD CONSTRAINT "tags_group_id_tag_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "cms"."tag_groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."space_groups_breadcrumbs" ADD CONSTRAINT "space_groups_breadcrumbs_doc_id_space_groups_id_fk" FOREIGN KEY ("doc_id") REFERENCES "cms"."space_groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."space_groups_breadcrumbs" ADD CONSTRAINT "space_groups_breadcrumbs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."space_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."space_groups" ADD CONSTRAINT "space_groups_parent_id_space_groups_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."space_groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."space_groups_rels" ADD CONSTRAINT "space_groups_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."space_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."space_groups_rels" ADD CONSTRAINT "space_groups_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "cms"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."community_spaces" ADD CONSTRAINT "community_spaces_space_group_id_space_groups_id_fk" FOREIGN KEY ("space_group_id") REFERENCES "cms"."space_groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."community_spaces" ADD CONSTRAINT "community_spaces_parent_space_id_community_spaces_id_fk" FOREIGN KEY ("parent_space_id") REFERENCES "cms"."community_spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."community_spaces" ADD CONSTRAINT "community_spaces_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."community_spaces_rels" ADD CONSTRAINT "community_spaces_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."community_spaces"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."community_spaces_rels" ADD CONSTRAINT "community_spaces_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "cms"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."community_spaces_rels" ADD CONSTRAINT "community_spaces_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "cms"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."community_posts" ADD CONSTRAINT "community_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."community_posts" ADD CONSTRAINT "community_posts_space_id_community_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "cms"."community_spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."community_posts_rels" ADD CONSTRAINT "community_posts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."community_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."community_posts_rels" ADD CONSTRAINT "community_posts_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "cms"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."community_posts_rels" ADD CONSTRAINT "community_posts_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "cms"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."community_posts_rels" ADD CONSTRAINT "community_posts_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "cms"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."community_posts_rels" ADD CONSTRAINT "community_posts_rels_videos_fk" FOREIGN KEY ("videos_id") REFERENCES "cms"."videos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."community_posts_rels" ADD CONSTRAINT "community_posts_rels_audio_fk" FOREIGN KEY ("audio_id") REFERENCES "cms"."audio"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."community_posts_rels" ADD CONSTRAINT "community_posts_rels_series_fk" FOREIGN KEY ("series_id") REFERENCES "cms"."series"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."community_posts_rels" ADD CONSTRAINT "community_posts_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "cms"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."community_posts_rels" ADD CONSTRAINT "community_posts_rels_locations_fk" FOREIGN KEY ("locations_id") REFERENCES "cms"."locations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."community_posts_rels" ADD CONSTRAINT "community_posts_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "cms"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."comments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."comments_rels" ADD CONSTRAINT "comments_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."comments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."comments_rels" ADD CONSTRAINT "comments_rels_community_posts_fk" FOREIGN KEY ("community_posts_id") REFERENCES "cms"."community_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."comments_rels" ADD CONSTRAINT "comments_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "cms"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."comments_rels" ADD CONSTRAINT "comments_rels_videos_fk" FOREIGN KEY ("videos_id") REFERENCES "cms"."videos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."comments_rels" ADD CONSTRAINT "comments_rels_audio_fk" FOREIGN KEY ("audio_id") REFERENCES "cms"."audio"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."comments_rels" ADD CONSTRAINT "comments_rels_photos_fk" FOREIGN KEY ("photos_id") REFERENCES "cms"."photos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."comments_rels" ADD CONSTRAINT "comments_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "cms"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."comments_rels" ADD CONSTRAINT "comments_rels_locations_fk" FOREIGN KEY ("locations_id") REFERENCES "cms"."locations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."reports" ADD CONSTRAINT "reports_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."reports_rels" ADD CONSTRAINT "reports_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."reports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."reports_rels" ADD CONSTRAINT "reports_rels_community_posts_fk" FOREIGN KEY ("community_posts_id") REFERENCES "cms"."community_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."reports_rels" ADD CONSTRAINT "reports_rels_comments_fk" FOREIGN KEY ("comments_id") REFERENCES "cms"."comments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."plans_features" ADD CONSTRAINT "plans_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."coupons_rels" ADD CONSTRAINT "coupons_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."coupons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."coupons_rels" ADD CONSTRAINT "coupons_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "cms"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "cms"."plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."subscriptions" ADD CONSTRAINT "subscriptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "cms"."coupons"("id") ON DELETE set null ON UPDATE no action;
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
  ALTER TABLE "cms"."pages_breadcrumbs" ADD CONSTRAINT "pages_breadcrumbs_doc_id_pages_id_fk" FOREIGN KEY ("doc_id") REFERENCES "cms"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."pages_breadcrumbs" ADD CONSTRAINT "pages_breadcrumbs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."pages" ADD CONSTRAINT "pages_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."pages" ADD CONSTRAINT "pages_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."pages"("id") ON DELETE set null ON UPDATE no action;
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
  ALTER TABLE "cms"."_pages_v_version_breadcrumbs" ADD CONSTRAINT "_pages_v_version_breadcrumbs_doc_id_pages_id_fk" FOREIGN KEY ("doc_id") REFERENCES "cms"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v_version_breadcrumbs" ADD CONSTRAINT "_pages_v_version_breadcrumbs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v" ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v" ADD CONSTRAINT "_pages_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_pages_v" ADD CONSTRAINT "_pages_v_version_parent_id_pages_id_fk" FOREIGN KEY ("version_parent_id") REFERENCES "cms"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."onboarding" ADD CONSTRAINT "onboarding_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."onboarding" ADD CONSTRAINT "onboarding_animation_id_media_id_fk" FOREIGN KEY ("animation_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."onboarding_rels" ADD CONSTRAINT "onboarding_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."onboarding"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."onboarding_rels" ADD CONSTRAINT "onboarding_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "cms"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."onboarding_rels" ADD CONSTRAINT "onboarding_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "cms"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."onboarding_rels" ADD CONSTRAINT "onboarding_rels_videos_fk" FOREIGN KEY ("videos_id") REFERENCES "cms"."videos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."onboarding_rels" ADD CONSTRAINT "onboarding_rels_audio_fk" FOREIGN KEY ("audio_id") REFERENCES "cms"."audio"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."onboarding_rels" ADD CONSTRAINT "onboarding_rels_series_fk" FOREIGN KEY ("series_id") REFERENCES "cms"."series"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."onboarding_rels" ADD CONSTRAINT "onboarding_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "cms"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."onboarding_rels" ADD CONSTRAINT "onboarding_rels_locations_fk" FOREIGN KEY ("locations_id") REFERENCES "cms"."locations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."banners_target_platform" ADD CONSTRAINT "banners_target_platform_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."banners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."banners" ADD CONSTRAINT "banners_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."notifications_channel" ADD CONSTRAINT "notifications_channel_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."notifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."notifications" ADD CONSTRAINT "notifications_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."notifications_rels" ADD CONSTRAINT "notifications_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."notifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."notifications_rels" ADD CONSTRAINT "notifications_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "cms"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."forms_blocks_checkbox" ADD CONSTRAINT "forms_blocks_checkbox_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."forms_blocks_email" ADD CONSTRAINT "forms_blocks_email_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."forms_blocks_message" ADD CONSTRAINT "forms_blocks_message_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."forms_blocks_number" ADD CONSTRAINT "forms_blocks_number_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."forms_blocks_select_options" ADD CONSTRAINT "forms_blocks_select_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."forms_blocks_select"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."forms_blocks_select" ADD CONSTRAINT "forms_blocks_select_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."forms_blocks_text" ADD CONSTRAINT "forms_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."forms_blocks_textarea" ADD CONSTRAINT "forms_blocks_textarea_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."forms_emails" ADD CONSTRAINT "forms_emails_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."forms_rels" ADD CONSTRAINT "forms_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."forms_rels" ADD CONSTRAINT "forms_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "cms"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."form_submissions_submission_data" ADD CONSTRAINT "form_submissions_submission_data_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."form_submissions" ADD CONSTRAINT "form_submissions_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "cms"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_folders_folder_type" ADD CONSTRAINT "payload_folders_folder_type_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."payload_folders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_folders" ADD CONSTRAINT "payload_folders_folder_id_payload_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "cms"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "cms"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_device_tokens_fk" FOREIGN KEY ("device_tokens_id") REFERENCES "cms"."device_tokens"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_feed_tokens_fk" FOREIGN KEY ("feed_tokens_id") REFERENCES "cms"."feed_tokens"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_favorites_fk" FOREIGN KEY ("favorites_id") REFERENCES "cms"."favorites"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_enrollments_fk" FOREIGN KEY ("enrollments_id") REFERENCES "cms"."enrollments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reviews_fk" FOREIGN KEY ("reviews_id") REFERENCES "cms"."reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "cms"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "cms"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_videos_fk" FOREIGN KEY ("videos_id") REFERENCES "cms"."videos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audio_fk" FOREIGN KEY ("audio_id") REFERENCES "cms"."audio"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_photos_fk" FOREIGN KEY ("photos_id") REFERENCES "cms"."photos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_series_fk" FOREIGN KEY ("series_id") REFERENCES "cms"."series"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lessons_fk" FOREIGN KEY ("lessons_id") REFERENCES "cms"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_locations_fk" FOREIGN KEY ("locations_id") REFERENCES "cms"."locations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "cms"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "cms"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "cms"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tag_groups_fk" FOREIGN KEY ("tag_groups_id") REFERENCES "cms"."tag_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_space_groups_fk" FOREIGN KEY ("space_groups_id") REFERENCES "cms"."space_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_community_spaces_fk" FOREIGN KEY ("community_spaces_id") REFERENCES "cms"."community_spaces"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_community_posts_fk" FOREIGN KEY ("community_posts_id") REFERENCES "cms"."community_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_comments_fk" FOREIGN KEY ("comments_id") REFERENCES "cms"."comments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reports_fk" FOREIGN KEY ("reports_id") REFERENCES "cms"."reports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "cms"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_coupons_fk" FOREIGN KEY ("coupons_id") REFERENCES "cms"."coupons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscriptions_fk" FOREIGN KEY ("subscriptions_id") REFERENCES "cms"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "cms"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_onboarding_fk" FOREIGN KEY ("onboarding_id") REFERENCES "cms"."onboarding"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_banners_fk" FOREIGN KEY ("banners_id") REFERENCES "cms"."banners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notifications_fk" FOREIGN KEY ("notifications_id") REFERENCES "cms"."notifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_forms_fk" FOREIGN KEY ("forms_id") REFERENCES "cms"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_form_submissions_fk" FOREIGN KEY ("form_submissions_id") REFERENCES "cms"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_folders_fk" FOREIGN KEY ("payload_folders_id") REFERENCES "cms"."payload_folders"("id") ON DELETE cascade ON UPDATE no action;
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
  ALTER TABLE "cms"."pricing_settings_free_tier_features" ADD CONSTRAINT "pricing_settings_free_tier_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."pricing_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."pricing_settings_rels" ADD CONSTRAINT "pricing_settings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."pricing_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."pricing_settings_rels" ADD CONSTRAINT "pricing_settings_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "cms"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."profile_fields_fields_options" ADD CONSTRAINT "profile_fields_fields_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."profile_fields_fields"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."profile_fields_fields" ADD CONSTRAINT "profile_fields_fields_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."profile_fields"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_roles_order_idx" ON "cms"."users_roles" USING btree ("order");
  CREATE INDEX "users_roles_parent_idx" ON "cms"."users_roles" USING btree ("parent_id");
  CREATE INDEX "users_email_idx" ON "cms"."users" USING btree ("email");
  CREATE UNIQUE INDEX "users_supabase_user_id_idx" ON "cms"."users" USING btree ("supabase_user_id");
  CREATE UNIQUE INDEX "users_username_idx" ON "cms"."users" USING btree ("username");
  CREATE INDEX "users_avatar_idx" ON "cms"."users" USING btree ("avatar_id");
  CREATE INDEX "users_cover_image_idx" ON "cms"."users" USING btree ("cover_image_id");
  CREATE INDEX "users_updated_at_idx" ON "cms"."users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "cms"."users" USING btree ("created_at");
  CREATE INDEX "users_deleted_at_idx" ON "cms"."users" USING btree ("deleted_at");
  CREATE INDEX "users_rels_order_idx" ON "cms"."users_rels" USING btree ("order");
  CREATE INDEX "users_rels_parent_idx" ON "cms"."users_rels" USING btree ("parent_id");
  CREATE INDEX "users_rels_path_idx" ON "cms"."users_rels" USING btree ("path");
  CREATE INDEX "users_rels_tags_id_idx" ON "cms"."users_rels" USING btree ("tags_id");
  CREATE INDEX "device_tokens_user_idx" ON "cms"."device_tokens" USING btree ("user_id");
  CREATE UNIQUE INDEX "device_tokens_token_idx" ON "cms"."device_tokens" USING btree ("token");
  CREATE INDEX "device_tokens_updated_at_idx" ON "cms"."device_tokens" USING btree ("updated_at");
  CREATE INDEX "device_tokens_created_at_idx" ON "cms"."device_tokens" USING btree ("created_at");
  CREATE UNIQUE INDEX "feed_tokens_token_idx" ON "cms"."feed_tokens" USING btree ("token");
  CREATE INDEX "feed_tokens_user_idx" ON "cms"."feed_tokens" USING btree ("user_id");
  CREATE INDEX "feed_tokens_show_idx" ON "cms"."feed_tokens" USING btree ("show_id");
  CREATE INDEX "feed_tokens_updated_at_idx" ON "cms"."feed_tokens" USING btree ("updated_at");
  CREATE INDEX "feed_tokens_created_at_idx" ON "cms"."feed_tokens" USING btree ("created_at");
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
  CREATE INDEX "enrollments_progress_order_idx" ON "cms"."enrollments_progress" USING btree ("_order");
  CREATE INDEX "enrollments_progress_parent_id_idx" ON "cms"."enrollments_progress" USING btree ("_parent_id");
  CREATE INDEX "enrollments_progress_lesson_idx" ON "cms"."enrollments_progress" USING btree ("lesson_id");
  CREATE INDEX "enrollments_user_idx" ON "cms"."enrollments" USING btree ("user_id");
  CREATE INDEX "enrollments_course_idx" ON "cms"."enrollments" USING btree ("course_id");
  CREATE INDEX "enrollments_subscription_idx" ON "cms"."enrollments" USING btree ("subscription_id");
  CREATE INDEX "enrollments_updated_at_idx" ON "cms"."enrollments" USING btree ("updated_at");
  CREATE INDEX "enrollments_created_at_idx" ON "cms"."enrollments" USING btree ("created_at");
  CREATE UNIQUE INDEX "user_course_idx" ON "cms"."enrollments" USING btree ("user_id","course_id");
  CREATE INDEX "reviews_author_idx" ON "cms"."reviews" USING btree ("author_id");
  CREATE INDEX "reviews_status_idx" ON "cms"."reviews" USING btree ("status");
  CREATE INDEX "reviews_response_response_responded_by_idx" ON "cms"."reviews" USING btree ("response_responded_by_id");
  CREATE INDEX "reviews_updated_at_idx" ON "cms"."reviews" USING btree ("updated_at");
  CREATE INDEX "reviews_created_at_idx" ON "cms"."reviews" USING btree ("created_at");
  CREATE INDEX "reviews_deleted_at_idx" ON "cms"."reviews" USING btree ("deleted_at");
  CREATE INDEX "reviews_rels_order_idx" ON "cms"."reviews_rels" USING btree ("order");
  CREATE INDEX "reviews_rels_parent_idx" ON "cms"."reviews_rels" USING btree ("parent_id");
  CREATE INDEX "reviews_rels_path_idx" ON "cms"."reviews_rels" USING btree ("path");
  CREATE INDEX "reviews_rels_locations_id_idx" ON "cms"."reviews_rels" USING btree ("locations_id");
  CREATE INDEX "reviews_rels_events_id_idx" ON "cms"."reviews_rels" USING btree ("events_id");
  CREATE INDEX "reviews_rels_media_id_idx" ON "cms"."reviews_rels" USING btree ("media_id");
  CREATE INDEX "media_folder_idx" ON "cms"."media" USING btree ("folder_id");
  CREATE INDEX "media_updated_at_idx" ON "cms"."media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "cms"."media" USING btree ("created_at");
  CREATE INDEX "media_deleted_at_idx" ON "cms"."media" USING btree ("deleted_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "cms"."media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "cms"."media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "cms"."media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_hero_sizes_hero_filename_idx" ON "cms"."media" USING btree ("sizes_hero_filename");
  CREATE INDEX "media_rels_order_idx" ON "cms"."media_rels" USING btree ("order");
  CREATE INDEX "media_rels_parent_idx" ON "cms"."media_rels" USING btree ("parent_id");
  CREATE INDEX "media_rels_path_idx" ON "cms"."media_rels" USING btree ("path");
  CREATE INDEX "media_rels_tags_id_idx" ON "cms"."media_rels" USING btree ("tags_id");
  CREATE UNIQUE INDEX "posts_slug_idx" ON "cms"."posts" USING btree ("slug");
  CREATE INDEX "posts_featured_image_idx" ON "cms"."posts" USING btree ("featured_image_id");
  CREATE INDEX "posts_card_image_idx" ON "cms"."posts" USING btree ("card_image_id");
  CREATE INDEX "posts_author_idx" ON "cms"."posts" USING btree ("author_id");
  CREATE INDEX "posts_published_at_idx" ON "cms"."posts" USING btree ("published_at");
  CREATE INDEX "posts_meta_meta_image_idx" ON "cms"."posts" USING btree ("meta_image_id");
  CREATE INDEX "posts_folder_idx" ON "cms"."posts" USING btree ("folder_id");
  CREATE INDEX "posts_updated_at_idx" ON "cms"."posts" USING btree ("updated_at");
  CREATE INDEX "posts_created_at_idx" ON "cms"."posts" USING btree ("created_at");
  CREATE INDEX "posts_deleted_at_idx" ON "cms"."posts" USING btree ("deleted_at");
  CREATE INDEX "posts__status_idx" ON "cms"."posts" USING btree ("_status");
  CREATE INDEX "posts_rels_order_idx" ON "cms"."posts_rels" USING btree ("order");
  CREATE INDEX "posts_rels_parent_idx" ON "cms"."posts_rels" USING btree ("parent_id");
  CREATE INDEX "posts_rels_path_idx" ON "cms"."posts_rels" USING btree ("path");
  CREATE INDEX "posts_rels_media_id_idx" ON "cms"."posts_rels" USING btree ("media_id");
  CREATE INDEX "posts_rels_users_id_idx" ON "cms"."posts_rels" USING btree ("users_id");
  CREATE INDEX "posts_rels_categories_id_idx" ON "cms"."posts_rels" USING btree ("categories_id");
  CREATE INDEX "posts_rels_tags_id_idx" ON "cms"."posts_rels" USING btree ("tags_id");
  CREATE INDEX "posts_rels_posts_id_idx" ON "cms"."posts_rels" USING btree ("posts_id");
  CREATE INDEX "_posts_v_parent_idx" ON "cms"."_posts_v" USING btree ("parent_id");
  CREATE INDEX "_posts_v_version_version_slug_idx" ON "cms"."_posts_v" USING btree ("version_slug");
  CREATE INDEX "_posts_v_version_version_featured_image_idx" ON "cms"."_posts_v" USING btree ("version_featured_image_id");
  CREATE INDEX "_posts_v_version_version_card_image_idx" ON "cms"."_posts_v" USING btree ("version_card_image_id");
  CREATE INDEX "_posts_v_version_version_author_idx" ON "cms"."_posts_v" USING btree ("version_author_id");
  CREATE INDEX "_posts_v_version_version_published_at_idx" ON "cms"."_posts_v" USING btree ("version_published_at");
  CREATE INDEX "_posts_v_version_meta_version_meta_image_idx" ON "cms"."_posts_v" USING btree ("version_meta_image_id");
  CREATE INDEX "_posts_v_version_version_folder_idx" ON "cms"."_posts_v" USING btree ("version_folder_id");
  CREATE INDEX "_posts_v_version_version_updated_at_idx" ON "cms"."_posts_v" USING btree ("version_updated_at");
  CREATE INDEX "_posts_v_version_version_created_at_idx" ON "cms"."_posts_v" USING btree ("version_created_at");
  CREATE INDEX "_posts_v_version_version_deleted_at_idx" ON "cms"."_posts_v" USING btree ("version_deleted_at");
  CREATE INDEX "_posts_v_version_version__status_idx" ON "cms"."_posts_v" USING btree ("version__status");
  CREATE INDEX "_posts_v_created_at_idx" ON "cms"."_posts_v" USING btree ("created_at");
  CREATE INDEX "_posts_v_updated_at_idx" ON "cms"."_posts_v" USING btree ("updated_at");
  CREATE INDEX "_posts_v_latest_idx" ON "cms"."_posts_v" USING btree ("latest");
  CREATE INDEX "_posts_v_rels_order_idx" ON "cms"."_posts_v_rels" USING btree ("order");
  CREATE INDEX "_posts_v_rels_parent_idx" ON "cms"."_posts_v_rels" USING btree ("parent_id");
  CREATE INDEX "_posts_v_rels_path_idx" ON "cms"."_posts_v_rels" USING btree ("path");
  CREATE INDEX "_posts_v_rels_media_id_idx" ON "cms"."_posts_v_rels" USING btree ("media_id");
  CREATE INDEX "_posts_v_rels_users_id_idx" ON "cms"."_posts_v_rels" USING btree ("users_id");
  CREATE INDEX "_posts_v_rels_categories_id_idx" ON "cms"."_posts_v_rels" USING btree ("categories_id");
  CREATE INDEX "_posts_v_rels_tags_id_idx" ON "cms"."_posts_v_rels" USING btree ("tags_id");
  CREATE INDEX "_posts_v_rels_posts_id_idx" ON "cms"."_posts_v_rels" USING btree ("posts_id");
  CREATE INDEX "videos_captions_order_idx" ON "cms"."videos_captions" USING btree ("_order");
  CREATE INDEX "videos_captions_parent_id_idx" ON "cms"."videos_captions" USING btree ("_parent_id");
  CREATE INDEX "videos_captions_file_idx" ON "cms"."videos_captions" USING btree ("file_id");
  CREATE INDEX "videos_chapters_order_idx" ON "cms"."videos_chapters" USING btree ("_order");
  CREATE INDEX "videos_chapters_parent_id_idx" ON "cms"."videos_chapters" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "videos_slug_idx" ON "cms"."videos" USING btree ("slug");
  CREATE INDEX "videos_video_file_idx" ON "cms"."videos" USING btree ("video_file_id");
  CREATE INDEX "videos_thumbnail_idx" ON "cms"."videos" USING btree ("thumbnail_id");
  CREATE INDEX "videos_vertical_thumbnail_idx" ON "cms"."videos" USING btree ("vertical_thumbnail_id");
  CREATE INDEX "videos_preview_clip_idx" ON "cms"."videos" USING btree ("preview_clip_id");
  CREATE INDEX "videos_series_idx" ON "cms"."videos" USING btree ("series_id");
  CREATE INDEX "videos_published_at_idx" ON "cms"."videos" USING btree ("published_at");
  CREATE INDEX "videos_meta_meta_image_idx" ON "cms"."videos" USING btree ("meta_image_id");
  CREATE INDEX "videos_folder_idx" ON "cms"."videos" USING btree ("folder_id");
  CREATE INDEX "videos_updated_at_idx" ON "cms"."videos" USING btree ("updated_at");
  CREATE INDEX "videos_created_at_idx" ON "cms"."videos" USING btree ("created_at");
  CREATE INDEX "videos_deleted_at_idx" ON "cms"."videos" USING btree ("deleted_at");
  CREATE INDEX "videos__status_idx" ON "cms"."videos" USING btree ("_status");
  CREATE INDEX "videos_rels_order_idx" ON "cms"."videos_rels" USING btree ("order");
  CREATE INDEX "videos_rels_parent_idx" ON "cms"."videos_rels" USING btree ("parent_id");
  CREATE INDEX "videos_rels_path_idx" ON "cms"."videos_rels" USING btree ("path");
  CREATE INDEX "videos_rels_categories_id_idx" ON "cms"."videos_rels" USING btree ("categories_id");
  CREATE INDEX "videos_rels_tags_id_idx" ON "cms"."videos_rels" USING btree ("tags_id");
  CREATE INDEX "_videos_v_version_captions_order_idx" ON "cms"."_videos_v_version_captions" USING btree ("_order");
  CREATE INDEX "_videos_v_version_captions_parent_id_idx" ON "cms"."_videos_v_version_captions" USING btree ("_parent_id");
  CREATE INDEX "_videos_v_version_captions_file_idx" ON "cms"."_videos_v_version_captions" USING btree ("file_id");
  CREATE INDEX "_videos_v_version_chapters_order_idx" ON "cms"."_videos_v_version_chapters" USING btree ("_order");
  CREATE INDEX "_videos_v_version_chapters_parent_id_idx" ON "cms"."_videos_v_version_chapters" USING btree ("_parent_id");
  CREATE INDEX "_videos_v_parent_idx" ON "cms"."_videos_v" USING btree ("parent_id");
  CREATE INDEX "_videos_v_version_version_slug_idx" ON "cms"."_videos_v" USING btree ("version_slug");
  CREATE INDEX "_videos_v_version_version_video_file_idx" ON "cms"."_videos_v" USING btree ("version_video_file_id");
  CREATE INDEX "_videos_v_version_version_thumbnail_idx" ON "cms"."_videos_v" USING btree ("version_thumbnail_id");
  CREATE INDEX "_videos_v_version_version_vertical_thumbnail_idx" ON "cms"."_videos_v" USING btree ("version_vertical_thumbnail_id");
  CREATE INDEX "_videos_v_version_version_preview_clip_idx" ON "cms"."_videos_v" USING btree ("version_preview_clip_id");
  CREATE INDEX "_videos_v_version_version_series_idx" ON "cms"."_videos_v" USING btree ("version_series_id");
  CREATE INDEX "_videos_v_version_version_published_at_idx" ON "cms"."_videos_v" USING btree ("version_published_at");
  CREATE INDEX "_videos_v_version_meta_version_meta_image_idx" ON "cms"."_videos_v" USING btree ("version_meta_image_id");
  CREATE INDEX "_videos_v_version_version_folder_idx" ON "cms"."_videos_v" USING btree ("version_folder_id");
  CREATE INDEX "_videos_v_version_version_updated_at_idx" ON "cms"."_videos_v" USING btree ("version_updated_at");
  CREATE INDEX "_videos_v_version_version_created_at_idx" ON "cms"."_videos_v" USING btree ("version_created_at");
  CREATE INDEX "_videos_v_version_version_deleted_at_idx" ON "cms"."_videos_v" USING btree ("version_deleted_at");
  CREATE INDEX "_videos_v_version_version__status_idx" ON "cms"."_videos_v" USING btree ("version__status");
  CREATE INDEX "_videos_v_created_at_idx" ON "cms"."_videos_v" USING btree ("created_at");
  CREATE INDEX "_videos_v_updated_at_idx" ON "cms"."_videos_v" USING btree ("updated_at");
  CREATE INDEX "_videos_v_latest_idx" ON "cms"."_videos_v" USING btree ("latest");
  CREATE INDEX "_videos_v_rels_order_idx" ON "cms"."_videos_v_rels" USING btree ("order");
  CREATE INDEX "_videos_v_rels_parent_idx" ON "cms"."_videos_v_rels" USING btree ("parent_id");
  CREATE INDEX "_videos_v_rels_path_idx" ON "cms"."_videos_v_rels" USING btree ("path");
  CREATE INDEX "_videos_v_rels_categories_id_idx" ON "cms"."_videos_v_rels" USING btree ("categories_id");
  CREATE INDEX "_videos_v_rels_tags_id_idx" ON "cms"."_videos_v_rels" USING btree ("tags_id");
  CREATE INDEX "audio_chapters_order_idx" ON "cms"."audio_chapters" USING btree ("_order");
  CREATE INDEX "audio_chapters_parent_id_idx" ON "cms"."audio_chapters" USING btree ("_parent_id");
  CREATE INDEX "audio_soundbites_order_idx" ON "cms"."audio_soundbites" USING btree ("_order");
  CREATE INDEX "audio_soundbites_parent_id_idx" ON "cms"."audio_soundbites" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "audio_slug_idx" ON "cms"."audio" USING btree ("slug");
  CREATE UNIQUE INDEX "audio_guid_idx" ON "cms"."audio" USING btree ("guid");
  CREATE INDEX "audio_cover_art_idx" ON "cms"."audio" USING btree ("cover_art_id");
  CREATE INDEX "audio_transcript_file_idx" ON "cms"."audio" USING btree ("transcript_file_id");
  CREATE INDEX "audio_series_idx" ON "cms"."audio" USING btree ("series_id");
  CREATE INDEX "audio_published_at_idx" ON "cms"."audio" USING btree ("published_at");
  CREATE INDEX "audio_meta_meta_image_idx" ON "cms"."audio" USING btree ("meta_image_id");
  CREATE INDEX "audio_folder_idx" ON "cms"."audio" USING btree ("folder_id");
  CREATE INDEX "audio_updated_at_idx" ON "cms"."audio" USING btree ("updated_at");
  CREATE INDEX "audio_created_at_idx" ON "cms"."audio" USING btree ("created_at");
  CREATE INDEX "audio_deleted_at_idx" ON "cms"."audio" USING btree ("deleted_at");
  CREATE UNIQUE INDEX "audio_filename_idx" ON "cms"."audio" USING btree ("filename");
  CREATE INDEX "audio_rels_order_idx" ON "cms"."audio_rels" USING btree ("order");
  CREATE INDEX "audio_rels_parent_idx" ON "cms"."audio_rels" USING btree ("parent_id");
  CREATE INDEX "audio_rels_path_idx" ON "cms"."audio_rels" USING btree ("path");
  CREATE INDEX "audio_rels_categories_id_idx" ON "cms"."audio_rels" USING btree ("categories_id");
  CREATE INDEX "audio_rels_tags_id_idx" ON "cms"."audio_rels" USING btree ("tags_id");
  CREATE UNIQUE INDEX "photos_slug_idx" ON "cms"."photos" USING btree ("slug");
  CREATE INDEX "photos_location_idx" ON "cms"."photos" USING btree ("location_id");
  CREATE INDEX "photos_album_idx" ON "cms"."photos" USING btree ("album_id");
  CREATE INDEX "photos_published_at_idx" ON "cms"."photos" USING btree ("published_at");
  CREATE INDEX "photos_meta_meta_image_idx" ON "cms"."photos" USING btree ("meta_image_id");
  CREATE INDEX "photos_folder_idx" ON "cms"."photos" USING btree ("folder_id");
  CREATE INDEX "photos_updated_at_idx" ON "cms"."photos" USING btree ("updated_at");
  CREATE INDEX "photos_created_at_idx" ON "cms"."photos" USING btree ("created_at");
  CREATE INDEX "photos_deleted_at_idx" ON "cms"."photos" USING btree ("deleted_at");
  CREATE UNIQUE INDEX "photos_filename_idx" ON "cms"."photos" USING btree ("filename");
  CREATE INDEX "photos_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "cms"."photos" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "photos_sizes_card_sizes_card_filename_idx" ON "cms"."photos" USING btree ("sizes_card_filename");
  CREATE INDEX "photos_sizes_hero_sizes_hero_filename_idx" ON "cms"."photos" USING btree ("sizes_hero_filename");
  CREATE INDEX "photos_rels_order_idx" ON "cms"."photos_rels" USING btree ("order");
  CREATE INDEX "photos_rels_parent_idx" ON "cms"."photos_rels" USING btree ("parent_id");
  CREATE INDEX "photos_rels_path_idx" ON "cms"."photos_rels" USING btree ("path");
  CREATE INDEX "photos_rels_categories_id_idx" ON "cms"."photos_rels" USING btree ("categories_id");
  CREATE INDEX "photos_rels_tags_id_idx" ON "cms"."photos_rels" USING btree ("tags_id");
  CREATE INDEX "series_podcast_funding_order_idx" ON "cms"."series_podcast_funding" USING btree ("_order");
  CREATE INDEX "series_podcast_funding_parent_id_idx" ON "cms"."series_podcast_funding" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "series_slug_idx" ON "cms"."series" USING btree ("slug");
  CREATE INDEX "series_cover_art_idx" ON "cms"."series" USING btree ("cover_art_id");
  CREATE INDEX "series_featured_image_idx" ON "cms"."series" USING btree ("featured_image_id");
  CREATE INDEX "series_parent_series_idx" ON "cms"."series" USING btree ("parent_series_id");
  CREATE INDEX "series_podcast_podcast_artwork_idx" ON "cms"."series" USING btree ("podcast_artwork_id");
  CREATE INDEX "series_meta_meta_image_idx" ON "cms"."series" USING btree ("meta_image_id");
  CREATE INDEX "series_folder_idx" ON "cms"."series" USING btree ("folder_id");
  CREATE INDEX "series_updated_at_idx" ON "cms"."series" USING btree ("updated_at");
  CREATE INDEX "series_created_at_idx" ON "cms"."series" USING btree ("created_at");
  CREATE INDEX "series_deleted_at_idx" ON "cms"."series" USING btree ("deleted_at");
  CREATE INDEX "series__status_idx" ON "cms"."series" USING btree ("_status");
  CREATE INDEX "series_rels_order_idx" ON "cms"."series_rels" USING btree ("order");
  CREATE INDEX "series_rels_parent_idx" ON "cms"."series_rels" USING btree ("parent_id");
  CREATE INDEX "series_rels_path_idx" ON "cms"."series_rels" USING btree ("path");
  CREATE INDEX "series_rels_categories_id_idx" ON "cms"."series_rels" USING btree ("categories_id");
  CREATE INDEX "series_rels_tags_id_idx" ON "cms"."series_rels" USING btree ("tags_id");
  CREATE INDEX "series_rels_plans_id_idx" ON "cms"."series_rels" USING btree ("plans_id");
  CREATE INDEX "series_rels_users_id_idx" ON "cms"."series_rels" USING btree ("users_id");
  CREATE INDEX "_series_v_version_podcast_funding_order_idx" ON "cms"."_series_v_version_podcast_funding" USING btree ("_order");
  CREATE INDEX "_series_v_version_podcast_funding_parent_id_idx" ON "cms"."_series_v_version_podcast_funding" USING btree ("_parent_id");
  CREATE INDEX "_series_v_parent_idx" ON "cms"."_series_v" USING btree ("parent_id");
  CREATE INDEX "_series_v_version_version_slug_idx" ON "cms"."_series_v" USING btree ("version_slug");
  CREATE INDEX "_series_v_version_version_cover_art_idx" ON "cms"."_series_v" USING btree ("version_cover_art_id");
  CREATE INDEX "_series_v_version_version_featured_image_idx" ON "cms"."_series_v" USING btree ("version_featured_image_id");
  CREATE INDEX "_series_v_version_version_parent_series_idx" ON "cms"."_series_v" USING btree ("version_parent_series_id");
  CREATE INDEX "_series_v_version_podcast_version_podcast_artwork_idx" ON "cms"."_series_v" USING btree ("version_podcast_artwork_id");
  CREATE INDEX "_series_v_version_meta_version_meta_image_idx" ON "cms"."_series_v" USING btree ("version_meta_image_id");
  CREATE INDEX "_series_v_version_version_folder_idx" ON "cms"."_series_v" USING btree ("version_folder_id");
  CREATE INDEX "_series_v_version_version_updated_at_idx" ON "cms"."_series_v" USING btree ("version_updated_at");
  CREATE INDEX "_series_v_version_version_created_at_idx" ON "cms"."_series_v" USING btree ("version_created_at");
  CREATE INDEX "_series_v_version_version_deleted_at_idx" ON "cms"."_series_v" USING btree ("version_deleted_at");
  CREATE INDEX "_series_v_version_version__status_idx" ON "cms"."_series_v" USING btree ("version__status");
  CREATE INDEX "_series_v_created_at_idx" ON "cms"."_series_v" USING btree ("created_at");
  CREATE INDEX "_series_v_updated_at_idx" ON "cms"."_series_v" USING btree ("updated_at");
  CREATE INDEX "_series_v_latest_idx" ON "cms"."_series_v" USING btree ("latest");
  CREATE INDEX "_series_v_rels_order_idx" ON "cms"."_series_v_rels" USING btree ("order");
  CREATE INDEX "_series_v_rels_parent_idx" ON "cms"."_series_v_rels" USING btree ("parent_id");
  CREATE INDEX "_series_v_rels_path_idx" ON "cms"."_series_v_rels" USING btree ("path");
  CREATE INDEX "_series_v_rels_categories_id_idx" ON "cms"."_series_v_rels" USING btree ("categories_id");
  CREATE INDEX "_series_v_rels_tags_id_idx" ON "cms"."_series_v_rels" USING btree ("tags_id");
  CREATE INDEX "_series_v_rels_plans_id_idx" ON "cms"."_series_v_rels" USING btree ("plans_id");
  CREATE INDEX "_series_v_rels_users_id_idx" ON "cms"."_series_v_rels" USING btree ("users_id");
  CREATE UNIQUE INDEX "lessons_slug_idx" ON "cms"."lessons" USING btree ("slug");
  CREATE INDEX "lessons_course_idx" ON "cms"."lessons" USING btree ("course_id");
  CREATE INDEX "lessons_video_idx" ON "cms"."lessons" USING btree ("video_id");
  CREATE INDEX "lessons_audio_idx" ON "cms"."lessons" USING btree ("audio_id");
  CREATE INDEX "lessons_folder_idx" ON "cms"."lessons" USING btree ("folder_id");
  CREATE INDEX "lessons_updated_at_idx" ON "cms"."lessons" USING btree ("updated_at");
  CREATE INDEX "lessons_created_at_idx" ON "cms"."lessons" USING btree ("created_at");
  CREATE INDEX "lessons_deleted_at_idx" ON "cms"."lessons" USING btree ("deleted_at");
  CREATE INDEX "lessons__status_idx" ON "cms"."lessons" USING btree ("_status");
  CREATE INDEX "lessons_rels_order_idx" ON "cms"."lessons_rels" USING btree ("order");
  CREATE INDEX "lessons_rels_parent_idx" ON "cms"."lessons_rels" USING btree ("parent_id");
  CREATE INDEX "lessons_rels_path_idx" ON "cms"."lessons_rels" USING btree ("path");
  CREATE INDEX "lessons_rels_media_id_idx" ON "cms"."lessons_rels" USING btree ("media_id");
  CREATE INDEX "_lessons_v_parent_idx" ON "cms"."_lessons_v" USING btree ("parent_id");
  CREATE INDEX "_lessons_v_version_version_slug_idx" ON "cms"."_lessons_v" USING btree ("version_slug");
  CREATE INDEX "_lessons_v_version_version_course_idx" ON "cms"."_lessons_v" USING btree ("version_course_id");
  CREATE INDEX "_lessons_v_version_version_video_idx" ON "cms"."_lessons_v" USING btree ("version_video_id");
  CREATE INDEX "_lessons_v_version_version_audio_idx" ON "cms"."_lessons_v" USING btree ("version_audio_id");
  CREATE INDEX "_lessons_v_version_version_folder_idx" ON "cms"."_lessons_v" USING btree ("version_folder_id");
  CREATE INDEX "_lessons_v_version_version_updated_at_idx" ON "cms"."_lessons_v" USING btree ("version_updated_at");
  CREATE INDEX "_lessons_v_version_version_created_at_idx" ON "cms"."_lessons_v" USING btree ("version_created_at");
  CREATE INDEX "_lessons_v_version_version_deleted_at_idx" ON "cms"."_lessons_v" USING btree ("version_deleted_at");
  CREATE INDEX "_lessons_v_version_version__status_idx" ON "cms"."_lessons_v" USING btree ("version__status");
  CREATE INDEX "_lessons_v_created_at_idx" ON "cms"."_lessons_v" USING btree ("created_at");
  CREATE INDEX "_lessons_v_updated_at_idx" ON "cms"."_lessons_v" USING btree ("updated_at");
  CREATE INDEX "_lessons_v_latest_idx" ON "cms"."_lessons_v" USING btree ("latest");
  CREATE INDEX "_lessons_v_rels_order_idx" ON "cms"."_lessons_v_rels" USING btree ("order");
  CREATE INDEX "_lessons_v_rels_parent_idx" ON "cms"."_lessons_v_rels" USING btree ("parent_id");
  CREATE INDEX "_lessons_v_rels_path_idx" ON "cms"."_lessons_v_rels" USING btree ("path");
  CREATE INDEX "_lessons_v_rels_media_id_idx" ON "cms"."_lessons_v_rels" USING btree ("media_id");
  CREATE INDEX "locations_hours_order_idx" ON "cms"."locations_hours" USING btree ("_order");
  CREATE INDEX "locations_hours_parent_id_idx" ON "cms"."locations_hours" USING btree ("_parent_id");
  CREATE INDEX "locations_amenities_order_idx" ON "cms"."locations_amenities" USING btree ("order");
  CREATE INDEX "locations_amenities_parent_idx" ON "cms"."locations_amenities" USING btree ("parent_id");
  CREATE UNIQUE INDEX "locations_slug_idx" ON "cms"."locations" USING btree ("slug");
  CREATE INDEX "locations_featured_image_idx" ON "cms"."locations" USING btree ("featured_image_id");
  CREATE INDEX "locations_location_type_idx" ON "cms"."locations" USING btree ("location_type_id");
  CREATE INDEX "locations_meta_meta_image_idx" ON "cms"."locations" USING btree ("meta_image_id");
  CREATE INDEX "locations_folder_idx" ON "cms"."locations" USING btree ("folder_id");
  CREATE INDEX "locations_updated_at_idx" ON "cms"."locations" USING btree ("updated_at");
  CREATE INDEX "locations_created_at_idx" ON "cms"."locations" USING btree ("created_at");
  CREATE INDEX "locations_deleted_at_idx" ON "cms"."locations" USING btree ("deleted_at");
  CREATE INDEX "locations__status_idx" ON "cms"."locations" USING btree ("_status");
  CREATE INDEX "locations_rels_order_idx" ON "cms"."locations_rels" USING btree ("order");
  CREATE INDEX "locations_rels_parent_idx" ON "cms"."locations_rels" USING btree ("parent_id");
  CREATE INDEX "locations_rels_path_idx" ON "cms"."locations_rels" USING btree ("path");
  CREATE INDEX "locations_rels_media_id_idx" ON "cms"."locations_rels" USING btree ("media_id");
  CREATE INDEX "locations_rels_tags_id_idx" ON "cms"."locations_rels" USING btree ("tags_id");
  CREATE INDEX "_locations_v_version_hours_order_idx" ON "cms"."_locations_v_version_hours" USING btree ("_order");
  CREATE INDEX "_locations_v_version_hours_parent_id_idx" ON "cms"."_locations_v_version_hours" USING btree ("_parent_id");
  CREATE INDEX "_locations_v_version_amenities_order_idx" ON "cms"."_locations_v_version_amenities" USING btree ("order");
  CREATE INDEX "_locations_v_version_amenities_parent_idx" ON "cms"."_locations_v_version_amenities" USING btree ("parent_id");
  CREATE INDEX "_locations_v_parent_idx" ON "cms"."_locations_v" USING btree ("parent_id");
  CREATE INDEX "_locations_v_version_version_slug_idx" ON "cms"."_locations_v" USING btree ("version_slug");
  CREATE INDEX "_locations_v_version_version_featured_image_idx" ON "cms"."_locations_v" USING btree ("version_featured_image_id");
  CREATE INDEX "_locations_v_version_version_location_type_idx" ON "cms"."_locations_v" USING btree ("version_location_type_id");
  CREATE INDEX "_locations_v_version_meta_version_meta_image_idx" ON "cms"."_locations_v" USING btree ("version_meta_image_id");
  CREATE INDEX "_locations_v_version_version_folder_idx" ON "cms"."_locations_v" USING btree ("version_folder_id");
  CREATE INDEX "_locations_v_version_version_updated_at_idx" ON "cms"."_locations_v" USING btree ("version_updated_at");
  CREATE INDEX "_locations_v_version_version_created_at_idx" ON "cms"."_locations_v" USING btree ("version_created_at");
  CREATE INDEX "_locations_v_version_version_deleted_at_idx" ON "cms"."_locations_v" USING btree ("version_deleted_at");
  CREATE INDEX "_locations_v_version_version__status_idx" ON "cms"."_locations_v" USING btree ("version__status");
  CREATE INDEX "_locations_v_created_at_idx" ON "cms"."_locations_v" USING btree ("created_at");
  CREATE INDEX "_locations_v_updated_at_idx" ON "cms"."_locations_v" USING btree ("updated_at");
  CREATE INDEX "_locations_v_latest_idx" ON "cms"."_locations_v" USING btree ("latest");
  CREATE INDEX "_locations_v_rels_order_idx" ON "cms"."_locations_v_rels" USING btree ("order");
  CREATE INDEX "_locations_v_rels_parent_idx" ON "cms"."_locations_v_rels" USING btree ("parent_id");
  CREATE INDEX "_locations_v_rels_path_idx" ON "cms"."_locations_v_rels" USING btree ("path");
  CREATE INDEX "_locations_v_rels_media_id_idx" ON "cms"."_locations_v_rels" USING btree ("media_id");
  CREATE INDEX "_locations_v_rels_tags_id_idx" ON "cms"."_locations_v_rels" USING btree ("tags_id");
  CREATE UNIQUE INDEX "events_slug_idx" ON "cms"."events" USING btree ("slug");
  CREATE INDEX "events_event_type_idx" ON "cms"."events" USING btree ("event_type_id");
  CREATE INDEX "events_starts_at_idx" ON "cms"."events" USING btree ("starts_at");
  CREATE INDEX "events_location_idx" ON "cms"."events" USING btree ("location_id");
  CREATE INDEX "events_featured_image_idx" ON "cms"."events" USING btree ("featured_image_id");
  CREATE INDEX "events_organizer_idx" ON "cms"."events" USING btree ("organizer_id");
  CREATE INDEX "events_meta_meta_image_idx" ON "cms"."events" USING btree ("meta_image_id");
  CREATE INDEX "events_folder_idx" ON "cms"."events" USING btree ("folder_id");
  CREATE INDEX "events_updated_at_idx" ON "cms"."events" USING btree ("updated_at");
  CREATE INDEX "events_created_at_idx" ON "cms"."events" USING btree ("created_at");
  CREATE INDEX "events_deleted_at_idx" ON "cms"."events" USING btree ("deleted_at");
  CREATE INDEX "events__status_idx" ON "cms"."events" USING btree ("_status");
  CREATE INDEX "events_rels_order_idx" ON "cms"."events_rels" USING btree ("order");
  CREATE INDEX "events_rels_parent_idx" ON "cms"."events_rels" USING btree ("parent_id");
  CREATE INDEX "events_rels_path_idx" ON "cms"."events_rels" USING btree ("path");
  CREATE INDEX "events_rels_media_id_idx" ON "cms"."events_rels" USING btree ("media_id");
  CREATE INDEX "events_rels_users_id_idx" ON "cms"."events_rels" USING btree ("users_id");
  CREATE INDEX "_events_v_parent_idx" ON "cms"."_events_v" USING btree ("parent_id");
  CREATE INDEX "_events_v_version_version_slug_idx" ON "cms"."_events_v" USING btree ("version_slug");
  CREATE INDEX "_events_v_version_version_event_type_idx" ON "cms"."_events_v" USING btree ("version_event_type_id");
  CREATE INDEX "_events_v_version_version_starts_at_idx" ON "cms"."_events_v" USING btree ("version_starts_at");
  CREATE INDEX "_events_v_version_version_location_idx" ON "cms"."_events_v" USING btree ("version_location_id");
  CREATE INDEX "_events_v_version_version_featured_image_idx" ON "cms"."_events_v" USING btree ("version_featured_image_id");
  CREATE INDEX "_events_v_version_version_organizer_idx" ON "cms"."_events_v" USING btree ("version_organizer_id");
  CREATE INDEX "_events_v_version_meta_version_meta_image_idx" ON "cms"."_events_v" USING btree ("version_meta_image_id");
  CREATE INDEX "_events_v_version_version_folder_idx" ON "cms"."_events_v" USING btree ("version_folder_id");
  CREATE INDEX "_events_v_version_version_updated_at_idx" ON "cms"."_events_v" USING btree ("version_updated_at");
  CREATE INDEX "_events_v_version_version_created_at_idx" ON "cms"."_events_v" USING btree ("version_created_at");
  CREATE INDEX "_events_v_version_version_deleted_at_idx" ON "cms"."_events_v" USING btree ("version_deleted_at");
  CREATE INDEX "_events_v_version_version__status_idx" ON "cms"."_events_v" USING btree ("version__status");
  CREATE INDEX "_events_v_created_at_idx" ON "cms"."_events_v" USING btree ("created_at");
  CREATE INDEX "_events_v_updated_at_idx" ON "cms"."_events_v" USING btree ("updated_at");
  CREATE INDEX "_events_v_latest_idx" ON "cms"."_events_v" USING btree ("latest");
  CREATE INDEX "_events_v_rels_order_idx" ON "cms"."_events_v_rels" USING btree ("order");
  CREATE INDEX "_events_v_rels_parent_idx" ON "cms"."_events_v_rels" USING btree ("parent_id");
  CREATE INDEX "_events_v_rels_path_idx" ON "cms"."_events_v_rels" USING btree ("path");
  CREATE INDEX "_events_v_rels_media_id_idx" ON "cms"."_events_v_rels" USING btree ("media_id");
  CREATE INDEX "_events_v_rels_users_id_idx" ON "cms"."_events_v_rels" USING btree ("users_id");
  CREATE INDEX "categories_breadcrumbs_order_idx" ON "cms"."categories_breadcrumbs" USING btree ("_order");
  CREATE INDEX "categories_breadcrumbs_parent_id_idx" ON "cms"."categories_breadcrumbs" USING btree ("_parent_id");
  CREATE INDEX "categories_breadcrumbs_doc_idx" ON "cms"."categories_breadcrumbs" USING btree ("doc_id");
  CREATE UNIQUE INDEX "categories_slug_idx" ON "cms"."categories" USING btree ("slug");
  CREATE INDEX "categories_image_idx" ON "cms"."categories" USING btree ("image_id");
  CREATE INDEX "categories_parent_idx" ON "cms"."categories" USING btree ("parent_id");
  CREATE INDEX "categories_updated_at_idx" ON "cms"."categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "cms"."categories" USING btree ("created_at");
  CREATE INDEX "categories_deleted_at_idx" ON "cms"."categories" USING btree ("deleted_at");
  CREATE UNIQUE INDEX "tags_slug_idx" ON "cms"."tags" USING btree ("slug");
  CREATE INDEX "tags_group_idx" ON "cms"."tags" USING btree ("group_id");
  CREATE INDEX "tags_updated_at_idx" ON "cms"."tags" USING btree ("updated_at");
  CREATE INDEX "tags_created_at_idx" ON "cms"."tags" USING btree ("created_at");
  CREATE UNIQUE INDEX "tag_groups_slug_idx" ON "cms"."tag_groups" USING btree ("slug");
  CREATE INDEX "tag_groups_updated_at_idx" ON "cms"."tag_groups" USING btree ("updated_at");
  CREATE INDEX "tag_groups_created_at_idx" ON "cms"."tag_groups" USING btree ("created_at");
  CREATE INDEX "space_groups_breadcrumbs_order_idx" ON "cms"."space_groups_breadcrumbs" USING btree ("_order");
  CREATE INDEX "space_groups_breadcrumbs_parent_id_idx" ON "cms"."space_groups_breadcrumbs" USING btree ("_parent_id");
  CREATE INDEX "space_groups_breadcrumbs_doc_idx" ON "cms"."space_groups_breadcrumbs" USING btree ("doc_id");
  CREATE UNIQUE INDEX "space_groups_slug_idx" ON "cms"."space_groups" USING btree ("slug");
  CREATE INDEX "space_groups_parent_idx" ON "cms"."space_groups" USING btree ("parent_id");
  CREATE INDEX "space_groups_updated_at_idx" ON "cms"."space_groups" USING btree ("updated_at");
  CREATE INDEX "space_groups_created_at_idx" ON "cms"."space_groups" USING btree ("created_at");
  CREATE INDEX "space_groups_deleted_at_idx" ON "cms"."space_groups" USING btree ("deleted_at");
  CREATE INDEX "space_groups_rels_order_idx" ON "cms"."space_groups_rels" USING btree ("order");
  CREATE INDEX "space_groups_rels_parent_idx" ON "cms"."space_groups_rels" USING btree ("parent_id");
  CREATE INDEX "space_groups_rels_path_idx" ON "cms"."space_groups_rels" USING btree ("path");
  CREATE INDEX "space_groups_rels_plans_id_idx" ON "cms"."space_groups_rels" USING btree ("plans_id");
  CREATE UNIQUE INDEX "community_spaces_slug_idx" ON "cms"."community_spaces" USING btree ("slug");
  CREATE INDEX "community_spaces_space_group_idx" ON "cms"."community_spaces" USING btree ("space_group_id");
  CREATE INDEX "community_spaces_parent_space_idx" ON "cms"."community_spaces" USING btree ("parent_space_id");
  CREATE INDEX "community_spaces_image_idx" ON "cms"."community_spaces" USING btree ("image_id");
  CREATE INDEX "community_spaces_updated_at_idx" ON "cms"."community_spaces" USING btree ("updated_at");
  CREATE INDEX "community_spaces_created_at_idx" ON "cms"."community_spaces" USING btree ("created_at");
  CREATE INDEX "community_spaces_deleted_at_idx" ON "cms"."community_spaces" USING btree ("deleted_at");
  CREATE INDEX "community_spaces_rels_order_idx" ON "cms"."community_spaces_rels" USING btree ("order");
  CREATE INDEX "community_spaces_rels_parent_idx" ON "cms"."community_spaces_rels" USING btree ("parent_id");
  CREATE INDEX "community_spaces_rels_path_idx" ON "cms"."community_spaces_rels" USING btree ("path");
  CREATE INDEX "community_spaces_rels_plans_id_idx" ON "cms"."community_spaces_rels" USING btree ("plans_id");
  CREATE INDEX "community_spaces_rels_users_id_idx" ON "cms"."community_spaces_rels" USING btree ("users_id");
  CREATE INDEX "community_posts_author_idx" ON "cms"."community_posts" USING btree ("author_id");
  CREATE INDEX "community_posts_space_idx" ON "cms"."community_posts" USING btree ("space_id");
  CREATE INDEX "community_posts_status_idx" ON "cms"."community_posts" USING btree ("status");
  CREATE INDEX "community_posts_published_at_idx" ON "cms"."community_posts" USING btree ("published_at");
  CREATE INDEX "community_posts_updated_at_idx" ON "cms"."community_posts" USING btree ("updated_at");
  CREATE INDEX "community_posts_created_at_idx" ON "cms"."community_posts" USING btree ("created_at");
  CREATE INDEX "community_posts_deleted_at_idx" ON "cms"."community_posts" USING btree ("deleted_at");
  CREATE INDEX "community_posts_rels_order_idx" ON "cms"."community_posts_rels" USING btree ("order");
  CREATE INDEX "community_posts_rels_parent_idx" ON "cms"."community_posts_rels" USING btree ("parent_id");
  CREATE INDEX "community_posts_rels_path_idx" ON "cms"."community_posts_rels" USING btree ("path");
  CREATE INDEX "community_posts_rels_media_id_idx" ON "cms"."community_posts_rels" USING btree ("media_id");
  CREATE INDEX "community_posts_rels_pages_id_idx" ON "cms"."community_posts_rels" USING btree ("pages_id");
  CREATE INDEX "community_posts_rels_posts_id_idx" ON "cms"."community_posts_rels" USING btree ("posts_id");
  CREATE INDEX "community_posts_rels_videos_id_idx" ON "cms"."community_posts_rels" USING btree ("videos_id");
  CREATE INDEX "community_posts_rels_audio_id_idx" ON "cms"."community_posts_rels" USING btree ("audio_id");
  CREATE INDEX "community_posts_rels_series_id_idx" ON "cms"."community_posts_rels" USING btree ("series_id");
  CREATE INDEX "community_posts_rels_events_id_idx" ON "cms"."community_posts_rels" USING btree ("events_id");
  CREATE INDEX "community_posts_rels_locations_id_idx" ON "cms"."community_posts_rels" USING btree ("locations_id");
  CREATE INDEX "community_posts_rels_tags_id_idx" ON "cms"."community_posts_rels" USING btree ("tags_id");
  CREATE INDEX "comments_author_idx" ON "cms"."comments" USING btree ("author_id");
  CREATE INDEX "comments_parent_idx" ON "cms"."comments" USING btree ("parent_id");
  CREATE INDEX "comments_status_idx" ON "cms"."comments" USING btree ("status");
  CREATE INDEX "comments_updated_at_idx" ON "cms"."comments" USING btree ("updated_at");
  CREATE INDEX "comments_created_at_idx" ON "cms"."comments" USING btree ("created_at");
  CREATE INDEX "comments_deleted_at_idx" ON "cms"."comments" USING btree ("deleted_at");
  CREATE INDEX "comments_rels_order_idx" ON "cms"."comments_rels" USING btree ("order");
  CREATE INDEX "comments_rels_parent_idx" ON "cms"."comments_rels" USING btree ("parent_id");
  CREATE INDEX "comments_rels_path_idx" ON "cms"."comments_rels" USING btree ("path");
  CREATE INDEX "comments_rels_community_posts_id_idx" ON "cms"."comments_rels" USING btree ("community_posts_id");
  CREATE INDEX "comments_rels_posts_id_idx" ON "cms"."comments_rels" USING btree ("posts_id");
  CREATE INDEX "comments_rels_videos_id_idx" ON "cms"."comments_rels" USING btree ("videos_id");
  CREATE INDEX "comments_rels_audio_id_idx" ON "cms"."comments_rels" USING btree ("audio_id");
  CREATE INDEX "comments_rels_photos_id_idx" ON "cms"."comments_rels" USING btree ("photos_id");
  CREATE INDEX "comments_rels_events_id_idx" ON "cms"."comments_rels" USING btree ("events_id");
  CREATE INDEX "comments_rels_locations_id_idx" ON "cms"."comments_rels" USING btree ("locations_id");
  CREATE INDEX "reports_reporter_idx" ON "cms"."reports" USING btree ("reporter_id");
  CREATE INDEX "reports_status_idx" ON "cms"."reports" USING btree ("status");
  CREATE INDEX "reports_resolved_by_idx" ON "cms"."reports" USING btree ("resolved_by_id");
  CREATE INDEX "reports_updated_at_idx" ON "cms"."reports" USING btree ("updated_at");
  CREATE INDEX "reports_created_at_idx" ON "cms"."reports" USING btree ("created_at");
  CREATE INDEX "reports_rels_order_idx" ON "cms"."reports_rels" USING btree ("order");
  CREATE INDEX "reports_rels_parent_idx" ON "cms"."reports_rels" USING btree ("parent_id");
  CREATE INDEX "reports_rels_path_idx" ON "cms"."reports_rels" USING btree ("path");
  CREATE INDEX "reports_rels_community_posts_id_idx" ON "cms"."reports_rels" USING btree ("community_posts_id");
  CREATE INDEX "reports_rels_comments_id_idx" ON "cms"."reports_rels" USING btree ("comments_id");
  CREATE INDEX "plans_features_order_idx" ON "cms"."plans_features" USING btree ("_order");
  CREATE INDEX "plans_features_parent_id_idx" ON "cms"."plans_features" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "plans_slug_idx" ON "cms"."plans" USING btree ("slug");
  CREATE INDEX "plans_updated_at_idx" ON "cms"."plans" USING btree ("updated_at");
  CREATE INDEX "plans_created_at_idx" ON "cms"."plans" USING btree ("created_at");
  CREATE INDEX "coupons_updated_at_idx" ON "cms"."coupons" USING btree ("updated_at");
  CREATE INDEX "coupons_created_at_idx" ON "cms"."coupons" USING btree ("created_at");
  CREATE INDEX "coupons_rels_order_idx" ON "cms"."coupons_rels" USING btree ("order");
  CREATE INDEX "coupons_rels_parent_idx" ON "cms"."coupons_rels" USING btree ("parent_id");
  CREATE INDEX "coupons_rels_path_idx" ON "cms"."coupons_rels" USING btree ("path");
  CREATE INDEX "coupons_rels_plans_id_idx" ON "cms"."coupons_rels" USING btree ("plans_id");
  CREATE INDEX "subscriptions_user_idx" ON "cms"."subscriptions" USING btree ("user_id");
  CREATE INDEX "subscriptions_plan_idx" ON "cms"."subscriptions" USING btree ("plan_id");
  CREATE INDEX "subscriptions_coupon_idx" ON "cms"."subscriptions" USING btree ("coupon_id");
  CREATE INDEX "subscriptions_status_idx" ON "cms"."subscriptions" USING btree ("status");
  CREATE UNIQUE INDEX "subscriptions_stripe_subscription_i_d_idx" ON "cms"."subscriptions" USING btree ("stripe_subscription_i_d");
  CREATE INDEX "subscriptions_stripe_customer_i_d_idx" ON "cms"."subscriptions" USING btree ("stripe_customer_i_d");
  CREATE INDEX "subscriptions_updated_at_idx" ON "cms"."subscriptions" USING btree ("updated_at");
  CREATE INDEX "subscriptions_created_at_idx" ON "cms"."subscriptions" USING btree ("created_at");
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
  CREATE INDEX "pages_breadcrumbs_order_idx" ON "cms"."pages_breadcrumbs" USING btree ("_order");
  CREATE INDEX "pages_breadcrumbs_parent_id_idx" ON "cms"."pages_breadcrumbs" USING btree ("_parent_id");
  CREATE INDEX "pages_breadcrumbs_doc_idx" ON "cms"."pages_breadcrumbs" USING btree ("doc_id");
  CREATE UNIQUE INDEX "pages_slug_idx" ON "cms"."pages" USING btree ("slug");
  CREATE INDEX "pages_meta_meta_image_idx" ON "cms"."pages" USING btree ("meta_image_id");
  CREATE INDEX "pages_parent_idx" ON "cms"."pages" USING btree ("parent_id");
  CREATE INDEX "pages_updated_at_idx" ON "cms"."pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "cms"."pages" USING btree ("created_at");
  CREATE INDEX "pages_deleted_at_idx" ON "cms"."pages" USING btree ("deleted_at");
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
  CREATE INDEX "_pages_v_version_breadcrumbs_order_idx" ON "cms"."_pages_v_version_breadcrumbs" USING btree ("_order");
  CREATE INDEX "_pages_v_version_breadcrumbs_parent_id_idx" ON "cms"."_pages_v_version_breadcrumbs" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_version_breadcrumbs_doc_idx" ON "cms"."_pages_v_version_breadcrumbs" USING btree ("doc_id");
  CREATE INDEX "_pages_v_parent_idx" ON "cms"."_pages_v" USING btree ("parent_id");
  CREATE INDEX "_pages_v_version_version_slug_idx" ON "cms"."_pages_v" USING btree ("version_slug");
  CREATE INDEX "_pages_v_version_meta_version_meta_image_idx" ON "cms"."_pages_v" USING btree ("version_meta_image_id");
  CREATE INDEX "_pages_v_version_version_parent_idx" ON "cms"."_pages_v" USING btree ("version_parent_id");
  CREATE INDEX "_pages_v_version_version_updated_at_idx" ON "cms"."_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_pages_v_version_version_created_at_idx" ON "cms"."_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_pages_v_version_version_deleted_at_idx" ON "cms"."_pages_v" USING btree ("version_deleted_at");
  CREATE INDEX "_pages_v_version_version__status_idx" ON "cms"."_pages_v" USING btree ("version__status");
  CREATE INDEX "_pages_v_created_at_idx" ON "cms"."_pages_v" USING btree ("created_at");
  CREATE INDEX "_pages_v_updated_at_idx" ON "cms"."_pages_v" USING btree ("updated_at");
  CREATE INDEX "_pages_v_latest_idx" ON "cms"."_pages_v" USING btree ("latest");
  CREATE INDEX "onboarding_image_idx" ON "cms"."onboarding" USING btree ("image_id");
  CREATE INDEX "onboarding_animation_idx" ON "cms"."onboarding" USING btree ("animation_id");
  CREATE INDEX "onboarding_updated_at_idx" ON "cms"."onboarding" USING btree ("updated_at");
  CREATE INDEX "onboarding_created_at_idx" ON "cms"."onboarding" USING btree ("created_at");
  CREATE INDEX "onboarding_rels_order_idx" ON "cms"."onboarding_rels" USING btree ("order");
  CREATE INDEX "onboarding_rels_parent_idx" ON "cms"."onboarding_rels" USING btree ("parent_id");
  CREATE INDEX "onboarding_rels_path_idx" ON "cms"."onboarding_rels" USING btree ("path");
  CREATE INDEX "onboarding_rels_pages_id_idx" ON "cms"."onboarding_rels" USING btree ("pages_id");
  CREATE INDEX "onboarding_rels_posts_id_idx" ON "cms"."onboarding_rels" USING btree ("posts_id");
  CREATE INDEX "onboarding_rels_videos_id_idx" ON "cms"."onboarding_rels" USING btree ("videos_id");
  CREATE INDEX "onboarding_rels_audio_id_idx" ON "cms"."onboarding_rels" USING btree ("audio_id");
  CREATE INDEX "onboarding_rels_series_id_idx" ON "cms"."onboarding_rels" USING btree ("series_id");
  CREATE INDEX "onboarding_rels_events_id_idx" ON "cms"."onboarding_rels" USING btree ("events_id");
  CREATE INDEX "onboarding_rels_locations_id_idx" ON "cms"."onboarding_rels" USING btree ("locations_id");
  CREATE INDEX "banners_target_platform_order_idx" ON "cms"."banners_target_platform" USING btree ("order");
  CREATE INDEX "banners_target_platform_parent_idx" ON "cms"."banners_target_platform" USING btree ("parent_id");
  CREATE INDEX "banners_image_idx" ON "cms"."banners" USING btree ("image_id");
  CREATE INDEX "banners_starts_at_idx" ON "cms"."banners" USING btree ("starts_at");
  CREATE INDEX "banners_ends_at_idx" ON "cms"."banners" USING btree ("ends_at");
  CREATE INDEX "banners_updated_at_idx" ON "cms"."banners" USING btree ("updated_at");
  CREATE INDEX "banners_created_at_idx" ON "cms"."banners" USING btree ("created_at");
  CREATE INDEX "notifications_channel_order_idx" ON "cms"."notifications_channel" USING btree ("order");
  CREATE INDEX "notifications_channel_parent_idx" ON "cms"."notifications_channel" USING btree ("parent_id");
  CREATE INDEX "notifications_image_idx" ON "cms"."notifications" USING btree ("image_id");
  CREATE INDEX "notifications_updated_at_idx" ON "cms"."notifications" USING btree ("updated_at");
  CREATE INDEX "notifications_created_at_idx" ON "cms"."notifications" USING btree ("created_at");
  CREATE INDEX "notifications_deleted_at_idx" ON "cms"."notifications" USING btree ("deleted_at");
  CREATE INDEX "notifications_rels_order_idx" ON "cms"."notifications_rels" USING btree ("order");
  CREATE INDEX "notifications_rels_parent_idx" ON "cms"."notifications_rels" USING btree ("parent_id");
  CREATE INDEX "notifications_rels_path_idx" ON "cms"."notifications_rels" USING btree ("path");
  CREATE INDEX "notifications_rels_users_id_idx" ON "cms"."notifications_rels" USING btree ("users_id");
  CREATE INDEX "forms_blocks_checkbox_order_idx" ON "cms"."forms_blocks_checkbox" USING btree ("_order");
  CREATE INDEX "forms_blocks_checkbox_parent_id_idx" ON "cms"."forms_blocks_checkbox" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_checkbox_path_idx" ON "cms"."forms_blocks_checkbox" USING btree ("_path");
  CREATE INDEX "forms_blocks_email_order_idx" ON "cms"."forms_blocks_email" USING btree ("_order");
  CREATE INDEX "forms_blocks_email_parent_id_idx" ON "cms"."forms_blocks_email" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_email_path_idx" ON "cms"."forms_blocks_email" USING btree ("_path");
  CREATE INDEX "forms_blocks_message_order_idx" ON "cms"."forms_blocks_message" USING btree ("_order");
  CREATE INDEX "forms_blocks_message_parent_id_idx" ON "cms"."forms_blocks_message" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_message_path_idx" ON "cms"."forms_blocks_message" USING btree ("_path");
  CREATE INDEX "forms_blocks_number_order_idx" ON "cms"."forms_blocks_number" USING btree ("_order");
  CREATE INDEX "forms_blocks_number_parent_id_idx" ON "cms"."forms_blocks_number" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_number_path_idx" ON "cms"."forms_blocks_number" USING btree ("_path");
  CREATE INDEX "forms_blocks_select_options_order_idx" ON "cms"."forms_blocks_select_options" USING btree ("_order");
  CREATE INDEX "forms_blocks_select_options_parent_id_idx" ON "cms"."forms_blocks_select_options" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_select_order_idx" ON "cms"."forms_blocks_select" USING btree ("_order");
  CREATE INDEX "forms_blocks_select_parent_id_idx" ON "cms"."forms_blocks_select" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_select_path_idx" ON "cms"."forms_blocks_select" USING btree ("_path");
  CREATE INDEX "forms_blocks_text_order_idx" ON "cms"."forms_blocks_text" USING btree ("_order");
  CREATE INDEX "forms_blocks_text_parent_id_idx" ON "cms"."forms_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_text_path_idx" ON "cms"."forms_blocks_text" USING btree ("_path");
  CREATE INDEX "forms_blocks_textarea_order_idx" ON "cms"."forms_blocks_textarea" USING btree ("_order");
  CREATE INDEX "forms_blocks_textarea_parent_id_idx" ON "cms"."forms_blocks_textarea" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_textarea_path_idx" ON "cms"."forms_blocks_textarea" USING btree ("_path");
  CREATE INDEX "forms_emails_order_idx" ON "cms"."forms_emails" USING btree ("_order");
  CREATE INDEX "forms_emails_parent_id_idx" ON "cms"."forms_emails" USING btree ("_parent_id");
  CREATE INDEX "forms_updated_at_idx" ON "cms"."forms" USING btree ("updated_at");
  CREATE INDEX "forms_created_at_idx" ON "cms"."forms" USING btree ("created_at");
  CREATE INDEX "forms_rels_order_idx" ON "cms"."forms_rels" USING btree ("order");
  CREATE INDEX "forms_rels_parent_idx" ON "cms"."forms_rels" USING btree ("parent_id");
  CREATE INDEX "forms_rels_path_idx" ON "cms"."forms_rels" USING btree ("path");
  CREATE INDEX "forms_rels_pages_id_idx" ON "cms"."forms_rels" USING btree ("pages_id");
  CREATE INDEX "form_submissions_submission_data_order_idx" ON "cms"."form_submissions_submission_data" USING btree ("_order");
  CREATE INDEX "form_submissions_submission_data_parent_id_idx" ON "cms"."form_submissions_submission_data" USING btree ("_parent_id");
  CREATE INDEX "form_submissions_form_idx" ON "cms"."form_submissions" USING btree ("form_id");
  CREATE INDEX "form_submissions_updated_at_idx" ON "cms"."form_submissions" USING btree ("updated_at");
  CREATE INDEX "form_submissions_created_at_idx" ON "cms"."form_submissions" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "cms"."payload_kv" USING btree ("key");
  CREATE INDEX "payload_jobs_log_order_idx" ON "cms"."payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "cms"."payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "cms"."payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "cms"."payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "cms"."payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "cms"."payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "cms"."payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "cms"."payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_idx" ON "cms"."payload_jobs" USING btree ("processing");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "cms"."payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "cms"."payload_jobs" USING btree ("created_at");
  CREATE INDEX "payload_folders_folder_type_order_idx" ON "cms"."payload_folders_folder_type" USING btree ("order");
  CREATE INDEX "payload_folders_folder_type_parent_idx" ON "cms"."payload_folders_folder_type" USING btree ("parent_id");
  CREATE INDEX "payload_folders_name_idx" ON "cms"."payload_folders" USING btree ("name");
  CREATE INDEX "payload_folders_folder_idx" ON "cms"."payload_folders" USING btree ("folder_id");
  CREATE INDEX "payload_folders_updated_at_idx" ON "cms"."payload_folders" USING btree ("updated_at");
  CREATE INDEX "payload_folders_created_at_idx" ON "cms"."payload_folders" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "cms"."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "cms"."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "cms"."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "cms"."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "cms"."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "cms"."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_device_tokens_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("device_tokens_id");
  CREATE INDEX "payload_locked_documents_rels_feed_tokens_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("feed_tokens_id");
  CREATE INDEX "payload_locked_documents_rels_favorites_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("favorites_id");
  CREATE INDEX "payload_locked_documents_rels_enrollments_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("enrollments_id");
  CREATE INDEX "payload_locked_documents_rels_reviews_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("reviews_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_posts_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("posts_id");
  CREATE INDEX "payload_locked_documents_rels_videos_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("videos_id");
  CREATE INDEX "payload_locked_documents_rels_audio_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("audio_id");
  CREATE INDEX "payload_locked_documents_rels_photos_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("photos_id");
  CREATE INDEX "payload_locked_documents_rels_series_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("series_id");
  CREATE INDEX "payload_locked_documents_rels_lessons_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("lessons_id");
  CREATE INDEX "payload_locked_documents_rels_locations_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("locations_id");
  CREATE INDEX "payload_locked_documents_rels_events_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("events_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_tags_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("tags_id");
  CREATE INDEX "payload_locked_documents_rels_tag_groups_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("tag_groups_id");
  CREATE INDEX "payload_locked_documents_rels_space_groups_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("space_groups_id");
  CREATE INDEX "payload_locked_documents_rels_community_spaces_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("community_spaces_id");
  CREATE INDEX "payload_locked_documents_rels_community_posts_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("community_posts_id");
  CREATE INDEX "payload_locked_documents_rels_comments_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("comments_id");
  CREATE INDEX "payload_locked_documents_rels_reports_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("reports_id");
  CREATE INDEX "payload_locked_documents_rels_plans_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("plans_id");
  CREATE INDEX "payload_locked_documents_rels_coupons_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("coupons_id");
  CREATE INDEX "payload_locked_documents_rels_subscriptions_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("subscriptions_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_onboarding_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("onboarding_id");
  CREATE INDEX "payload_locked_documents_rels_banners_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("banners_id");
  CREATE INDEX "payload_locked_documents_rels_notifications_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("notifications_id");
  CREATE INDEX "payload_locked_documents_rels_forms_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("forms_id");
  CREATE INDEX "payload_locked_documents_rels_form_submissions_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("form_submissions_id");
  CREATE INDEX "payload_locked_documents_rels_payload_folders_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("payload_folders_id");
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
  CREATE INDEX "_theme_settings_v_latest_idx" ON "cms"."_theme_settings_v" USING btree ("latest");
  CREATE INDEX "pricing_settings_free_tier_features_order_idx" ON "cms"."pricing_settings_free_tier_features" USING btree ("_order");
  CREATE INDEX "pricing_settings_free_tier_features_parent_id_idx" ON "cms"."pricing_settings_free_tier_features" USING btree ("_parent_id");
  CREATE INDEX "pricing_settings_rels_order_idx" ON "cms"."pricing_settings_rels" USING btree ("order");
  CREATE INDEX "pricing_settings_rels_parent_idx" ON "cms"."pricing_settings_rels" USING btree ("parent_id");
  CREATE INDEX "pricing_settings_rels_path_idx" ON "cms"."pricing_settings_rels" USING btree ("path");
  CREATE INDEX "pricing_settings_rels_plans_id_idx" ON "cms"."pricing_settings_rels" USING btree ("plans_id");
  CREATE INDEX "profile_fields_fields_options_order_idx" ON "cms"."profile_fields_fields_options" USING btree ("_order");
  CREATE INDEX "profile_fields_fields_options_parent_id_idx" ON "cms"."profile_fields_fields_options" USING btree ("_parent_id");
  CREATE INDEX "profile_fields_fields_order_idx" ON "cms"."profile_fields_fields" USING btree ("_order");
  CREATE INDEX "profile_fields_fields_parent_id_idx" ON "cms"."profile_fields_fields" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "cms"."users_roles" CASCADE;
  DROP TABLE "cms"."users" CASCADE;
  DROP TABLE "cms"."users_rels" CASCADE;
  DROP TABLE "cms"."device_tokens" CASCADE;
  DROP TABLE "cms"."feed_tokens" CASCADE;
  DROP TABLE "cms"."favorites" CASCADE;
  DROP TABLE "cms"."favorites_rels" CASCADE;
  DROP TABLE "cms"."enrollments_progress" CASCADE;
  DROP TABLE "cms"."enrollments" CASCADE;
  DROP TABLE "cms"."reviews" CASCADE;
  DROP TABLE "cms"."reviews_rels" CASCADE;
  DROP TABLE "cms"."media" CASCADE;
  DROP TABLE "cms"."media_rels" CASCADE;
  DROP TABLE "cms"."posts" CASCADE;
  DROP TABLE "cms"."posts_rels" CASCADE;
  DROP TABLE "cms"."_posts_v" CASCADE;
  DROP TABLE "cms"."_posts_v_rels" CASCADE;
  DROP TABLE "cms"."videos_captions" CASCADE;
  DROP TABLE "cms"."videos_chapters" CASCADE;
  DROP TABLE "cms"."videos" CASCADE;
  DROP TABLE "cms"."videos_rels" CASCADE;
  DROP TABLE "cms"."_videos_v_version_captions" CASCADE;
  DROP TABLE "cms"."_videos_v_version_chapters" CASCADE;
  DROP TABLE "cms"."_videos_v" CASCADE;
  DROP TABLE "cms"."_videos_v_rels" CASCADE;
  DROP TABLE "cms"."audio_chapters" CASCADE;
  DROP TABLE "cms"."audio_soundbites" CASCADE;
  DROP TABLE "cms"."audio" CASCADE;
  DROP TABLE "cms"."audio_rels" CASCADE;
  DROP TABLE "cms"."photos" CASCADE;
  DROP TABLE "cms"."photos_rels" CASCADE;
  DROP TABLE "cms"."series_podcast_funding" CASCADE;
  DROP TABLE "cms"."series" CASCADE;
  DROP TABLE "cms"."series_rels" CASCADE;
  DROP TABLE "cms"."_series_v_version_podcast_funding" CASCADE;
  DROP TABLE "cms"."_series_v" CASCADE;
  DROP TABLE "cms"."_series_v_rels" CASCADE;
  DROP TABLE "cms"."lessons" CASCADE;
  DROP TABLE "cms"."lessons_rels" CASCADE;
  DROP TABLE "cms"."_lessons_v" CASCADE;
  DROP TABLE "cms"."_lessons_v_rels" CASCADE;
  DROP TABLE "cms"."locations_hours" CASCADE;
  DROP TABLE "cms"."locations_amenities" CASCADE;
  DROP TABLE "cms"."locations" CASCADE;
  DROP TABLE "cms"."locations_rels" CASCADE;
  DROP TABLE "cms"."_locations_v_version_hours" CASCADE;
  DROP TABLE "cms"."_locations_v_version_amenities" CASCADE;
  DROP TABLE "cms"."_locations_v" CASCADE;
  DROP TABLE "cms"."_locations_v_rels" CASCADE;
  DROP TABLE "cms"."events" CASCADE;
  DROP TABLE "cms"."events_rels" CASCADE;
  DROP TABLE "cms"."_events_v" CASCADE;
  DROP TABLE "cms"."_events_v_rels" CASCADE;
  DROP TABLE "cms"."categories_breadcrumbs" CASCADE;
  DROP TABLE "cms"."categories" CASCADE;
  DROP TABLE "cms"."tags" CASCADE;
  DROP TABLE "cms"."tag_groups" CASCADE;
  DROP TABLE "cms"."space_groups_breadcrumbs" CASCADE;
  DROP TABLE "cms"."space_groups" CASCADE;
  DROP TABLE "cms"."space_groups_rels" CASCADE;
  DROP TABLE "cms"."community_spaces" CASCADE;
  DROP TABLE "cms"."community_spaces_rels" CASCADE;
  DROP TABLE "cms"."community_posts" CASCADE;
  DROP TABLE "cms"."community_posts_rels" CASCADE;
  DROP TABLE "cms"."comments" CASCADE;
  DROP TABLE "cms"."comments_rels" CASCADE;
  DROP TABLE "cms"."reports" CASCADE;
  DROP TABLE "cms"."reports_rels" CASCADE;
  DROP TABLE "cms"."plans_features" CASCADE;
  DROP TABLE "cms"."plans" CASCADE;
  DROP TABLE "cms"."coupons" CASCADE;
  DROP TABLE "cms"."coupons_rels" CASCADE;
  DROP TABLE "cms"."subscriptions" CASCADE;
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
  DROP TABLE "cms"."pages_breadcrumbs" CASCADE;
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
  DROP TABLE "cms"."_pages_v_version_breadcrumbs" CASCADE;
  DROP TABLE "cms"."_pages_v" CASCADE;
  DROP TABLE "cms"."onboarding" CASCADE;
  DROP TABLE "cms"."onboarding_rels" CASCADE;
  DROP TABLE "cms"."banners_target_platform" CASCADE;
  DROP TABLE "cms"."banners" CASCADE;
  DROP TABLE "cms"."notifications_channel" CASCADE;
  DROP TABLE "cms"."notifications" CASCADE;
  DROP TABLE "cms"."notifications_rels" CASCADE;
  DROP TABLE "cms"."forms_blocks_checkbox" CASCADE;
  DROP TABLE "cms"."forms_blocks_email" CASCADE;
  DROP TABLE "cms"."forms_blocks_message" CASCADE;
  DROP TABLE "cms"."forms_blocks_number" CASCADE;
  DROP TABLE "cms"."forms_blocks_select_options" CASCADE;
  DROP TABLE "cms"."forms_blocks_select" CASCADE;
  DROP TABLE "cms"."forms_blocks_text" CASCADE;
  DROP TABLE "cms"."forms_blocks_textarea" CASCADE;
  DROP TABLE "cms"."forms_emails" CASCADE;
  DROP TABLE "cms"."forms" CASCADE;
  DROP TABLE "cms"."forms_rels" CASCADE;
  DROP TABLE "cms"."form_submissions_submission_data" CASCADE;
  DROP TABLE "cms"."form_submissions" CASCADE;
  DROP TABLE "cms"."payload_kv" CASCADE;
  DROP TABLE "cms"."payload_jobs_log" CASCADE;
  DROP TABLE "cms"."payload_jobs" CASCADE;
  DROP TABLE "cms"."payload_folders_folder_type" CASCADE;
  DROP TABLE "cms"."payload_folders" CASCADE;
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
  DROP TABLE "cms"."pricing_settings_free_tier_features" CASCADE;
  DROP TABLE "cms"."pricing_settings" CASCADE;
  DROP TABLE "cms"."pricing_settings_rels" CASCADE;
  DROP TABLE "cms"."profile_fields_fields_options" CASCADE;
  DROP TABLE "cms"."profile_fields_fields" CASCADE;
  DROP TABLE "cms"."profile_fields" CASCADE;
  DROP TYPE "cms"."enum_users_roles";
  DROP TYPE "cms"."enum_users_member_status";
  DROP TYPE "cms"."enum_users_profile_visibility";
  DROP TYPE "cms"."enum_users_timezone";
  DROP TYPE "cms"."enum_users_preferred_language";
  DROP TYPE "cms"."enum_users_notification_preferences_email_digest";
  DROP TYPE "cms"."enum_device_tokens_platform";
  DROP TYPE "cms"."enum_enrollments_status";
  DROP TYPE "cms"."enum_enrollments_source";
  DROP TYPE "cms"."enum_reviews_status";
  DROP TYPE "cms"."enum_posts_access_level";
  DROP TYPE "cms"."enum_posts_status";
  DROP TYPE "cms"."enum__posts_v_version_access_level";
  DROP TYPE "cms"."enum__posts_v_version_status";
  DROP TYPE "cms"."enum_videos_captions_language";
  DROP TYPE "cms"."enum_videos_orientation";
  DROP TYPE "cms"."enum_videos_aspect_ratio";
  DROP TYPE "cms"."enum_videos_source_type";
  DROP TYPE "cms"."enum_videos_access_level";
  DROP TYPE "cms"."enum_videos_status";
  DROP TYPE "cms"."enum__videos_v_version_captions_language";
  DROP TYPE "cms"."enum__videos_v_version_orientation";
  DROP TYPE "cms"."enum__videos_v_version_aspect_ratio";
  DROP TYPE "cms"."enum__videos_v_version_source_type";
  DROP TYPE "cms"."enum__videos_v_version_access_level";
  DROP TYPE "cms"."enum__videos_v_version_status";
  DROP TYPE "cms"."enum_audio_episode_type";
  DROP TYPE "cms"."enum_audio_access_level";
  DROP TYPE "cms"."enum_photos_access_level";
  DROP TYPE "cms"."enum_series_kind";
  DROP TYPE "cms"."enum_series_access_level";
  DROP TYPE "cms"."enum_series_podcast_category";
  DROP TYPE "cms"."enum_series_podcast_subcategory";
  DROP TYPE "cms"."enum_series_podcast_type";
  DROP TYPE "cms"."enum_series_course_drip_anchor";
  DROP TYPE "cms"."enum_series_status";
  DROP TYPE "cms"."enum__series_v_version_kind";
  DROP TYPE "cms"."enum__series_v_version_access_level";
  DROP TYPE "cms"."enum__series_v_version_podcast_category";
  DROP TYPE "cms"."enum__series_v_version_podcast_subcategory";
  DROP TYPE "cms"."enum__series_v_version_podcast_type";
  DROP TYPE "cms"."enum__series_v_version_course_drip_anchor";
  DROP TYPE "cms"."enum__series_v_version_status";
  DROP TYPE "cms"."enum_lessons_drip_type";
  DROP TYPE "cms"."enum_lessons_drip_mode";
  DROP TYPE "cms"."enum_lessons_status";
  DROP TYPE "cms"."enum__lessons_v_version_drip_type";
  DROP TYPE "cms"."enum__lessons_v_version_drip_mode";
  DROP TYPE "cms"."enum__lessons_v_version_status";
  DROP TYPE "cms"."enum_locations_hours_day";
  DROP TYPE "cms"."enum_locations_amenities";
  DROP TYPE "cms"."enum_locations_price_range";
  DROP TYPE "cms"."enum_locations_status";
  DROP TYPE "cms"."enum__locations_v_version_hours_day";
  DROP TYPE "cms"."enum__locations_v_version_amenities";
  DROP TYPE "cms"."enum__locations_v_version_price_range";
  DROP TYPE "cms"."enum__locations_v_version_status";
  DROP TYPE "cms"."enum_events_timezone";
  DROP TYPE "cms"."enum_events_recurrence_frequency";
  DROP TYPE "cms"."enum_events_currency";
  DROP TYPE "cms"."enum_events_event_status";
  DROP TYPE "cms"."enum_events_status";
  DROP TYPE "cms"."enum__events_v_version_timezone";
  DROP TYPE "cms"."enum__events_v_version_recurrence_frequency";
  DROP TYPE "cms"."enum__events_v_version_currency";
  DROP TYPE "cms"."enum__events_v_version_event_status";
  DROP TYPE "cms"."enum__events_v_version_status";
  DROP TYPE "cms"."enum_space_groups_access_level";
  DROP TYPE "cms"."enum_community_spaces_access_level";
  DROP TYPE "cms"."enum_community_spaces_posting_policy";
  DROP TYPE "cms"."enum_community_posts_link_type";
  DROP TYPE "cms"."enum_community_posts_access_level";
  DROP TYPE "cms"."enum_community_posts_status";
  DROP TYPE "cms"."enum_comments_status";
  DROP TYPE "cms"."enum_reports_reason";
  DROP TYPE "cms"."enum_reports_status";
  DROP TYPE "cms"."enum_reports_resolution";
  DROP TYPE "cms"."enum_plans_pricing_type";
  DROP TYPE "cms"."enum_plans_interval";
  DROP TYPE "cms"."enum_plans_intro_offer_intro_interval";
  DROP TYPE "cms"."enum_plans_entitlement";
  DROP TYPE "cms"."enum_plans_sync_status";
  DROP TYPE "cms"."enum_coupons_discount_type";
  DROP TYPE "cms"."enum_coupons_duration";
  DROP TYPE "cms"."enum_coupons_duration_unit";
  DROP TYPE "cms"."enum_coupons_sync_status";
  DROP TYPE "cms"."enum_subscriptions_status";
  DROP TYPE "cms"."enum_pages_blocks_hero_buttons_variant";
  DROP TYPE "cms"."enum_pages_blocks_items_items_icon";
  DROP TYPE "cms"."enum_pages_blocks_cta_buttons_variant";
  DROP TYPE "cms"."enum_pages_status";
  DROP TYPE "cms"."enum__pages_v_blocks_hero_buttons_variant";
  DROP TYPE "cms"."enum__pages_v_blocks_items_items_icon";
  DROP TYPE "cms"."enum__pages_v_blocks_cta_buttons_variant";
  DROP TYPE "cms"."enum__pages_v_version_status";
  DROP TYPE "cms"."enum_onboarding_cta_destination_type";
  DROP TYPE "cms"."enum_onboarding_secondary_cta_destination_type";
  DROP TYPE "cms"."enum_banners_target_platform";
  DROP TYPE "cms"."enum_banners_variant";
  DROP TYPE "cms"."enum_banners_link_appearance";
  DROP TYPE "cms"."enum_banners_placement";
  DROP TYPE "cms"."enum_banners_audience";
  DROP TYPE "cms"."enum_notifications_channel";
  DROP TYPE "cms"."enum_notifications_audience";
  DROP TYPE "cms"."enum_notifications_status";
  DROP TYPE "cms"."enum_forms_confirmation_type";
  DROP TYPE "cms"."enum_forms_redirect_type";
  DROP TYPE "cms"."enum_payload_jobs_log_task_slug";
  DROP TYPE "cms"."enum_payload_jobs_log_state";
  DROP TYPE "cms"."enum_payload_jobs_task_slug";
  DROP TYPE "cms"."enum_payload_folders_folder_type";
  DROP TYPE "cms"."enum_site_settings_header_actions_variant";
  DROP TYPE "cms"."enum_theme_settings_font_sans";
  DROP TYPE "cms"."enum_theme_settings_font_serif";
  DROP TYPE "cms"."enum_theme_settings_font_mono";
  DROP TYPE "cms"."enum_theme_settings_status";
  DROP TYPE "cms"."enum__theme_settings_v_version_font_sans";
  DROP TYPE "cms"."enum__theme_settings_v_version_font_serif";
  DROP TYPE "cms"."enum__theme_settings_v_version_font_mono";
  DROP TYPE "cms"."enum__theme_settings_v_version_status";
  DROP TYPE "cms"."enum_profile_fields_fields_type";
  DROP TYPE "cms"."enum_profile_fields_fields_visibility";`)
}
