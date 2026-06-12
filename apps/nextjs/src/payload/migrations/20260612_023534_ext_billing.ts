// GENERATED copy (`pnpm ext sync`) of extensions/billing/src/payload/migrations/20260612_023534_ext_billing.ts
// so the local `payload migrate` CLI applies it — do not edit.
import { MigrateDownArgs, MigrateUpArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "cms"."enum_ext_billing_plans_pricing_type" AS ENUM('recurring', 'one_time');
  CREATE TYPE "cms"."enum_ext_billing_plans_interval" AS ENUM('day', 'week', 'month', 'year');
  CREATE TYPE "cms"."enum_ext_billing_plans_intro_offer_intro_interval" AS ENUM('month', 'year');
  CREATE TYPE "cms"."enum_ext_billing_plans_entitlement" AS ENUM('members', 'premium');
  CREATE TYPE "cms"."enum_ext_billing_plans_sync_status" AS ENUM('unsynced', 'synced', 'error');
  CREATE TYPE "cms"."enum_ext_billing_coupons_discount_type" AS ENUM('percent_off', 'amount_off');
  CREATE TYPE "cms"."enum_ext_billing_coupons_duration" AS ENUM('once', 'repeating', 'forever');
  CREATE TYPE "cms"."enum_ext_billing_coupons_duration_unit" AS ENUM('month', 'year');
  CREATE TYPE "cms"."enum_ext_billing_coupons_sync_status" AS ENUM('unsynced', 'synced', 'error');
  CREATE TYPE "cms"."enum_ext_billing_subscriptions_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'churned', 'paused');
  CREATE TYPE "cms"."enum_ext_billing_settings_billing_toggle_default" AS ENUM('monthly', 'annual');
  CREATE TYPE "cms"."enum__ext_billing_settings_v_version_billing_toggle_default" AS ENUM('monthly', 'annual');
  CREATE TABLE "cms"."ext_billing_plans_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL,
  	"included" boolean DEFAULT true
  );
  
  CREATE TABLE "cms"."ext_billing_plans" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"active" boolean DEFAULT true,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"pricing_type" "cms"."enum_ext_billing_plans_pricing_type" DEFAULT 'recurring' NOT NULL,
  	"interval" "cms"."enum_ext_billing_plans_interval" DEFAULT 'month',
  	"interval_count" numeric DEFAULT 1,
  	"unit_amount" numeric NOT NULL,
  	"currency" varchar DEFAULT 'usd' NOT NULL,
  	"trial_days" numeric,
  	"intro_offer_enabled" boolean DEFAULT false,
  	"intro_offer_intro_amount" numeric,
  	"intro_offer_intro_interval" "cms"."enum_ext_billing_plans_intro_offer_intro_interval" DEFAULT 'month',
  	"intro_offer_intro_periods" numeric DEFAULT 1,
  	"entitlement" "cms"."enum_ext_billing_plans_entitlement" DEFAULT 'premium',
  	"badge" varchar,
  	"highlighted" boolean DEFAULT false,
  	"display_order" numeric DEFAULT 0,
  	"skip_sync" boolean DEFAULT false,
  	"stripe_product_id" varchar,
  	"stripe_price_id" varchar,
  	"stripe_intro_coupon_id" varchar,
  	"sync_status" "cms"."enum_ext_billing_plans_sync_status" DEFAULT 'unsynced',
  	"sync_error" varchar,
  	"last_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."ext_billing_coupons" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"discount_type" "cms"."enum_ext_billing_coupons_discount_type" DEFAULT 'percent_off' NOT NULL,
  	"value" numeric NOT NULL,
  	"currency" varchar DEFAULT 'usd',
  	"duration" "cms"."enum_ext_billing_coupons_duration" DEFAULT 'once' NOT NULL,
  	"duration_count" numeric DEFAULT 1,
  	"duration_unit" "cms"."enum_ext_billing_coupons_duration_unit" DEFAULT 'month',
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
  	"sync_status" "cms"."enum_ext_billing_coupons_sync_status" DEFAULT 'unsynced',
  	"sync_error" varchar,
  	"last_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."ext_billing_coupons_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"ext_billing_plans_id" integer
  );
  
  CREATE TABLE "cms"."ext_billing_subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer,
  	"plan_id" integer,
  	"coupon_id" integer,
  	"status" "cms"."enum_ext_billing_subscriptions_status" NOT NULL,
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
  
  CREATE TABLE "cms"."ext_billing_settings_free_tier_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"included" boolean DEFAULT true
  );
  
  CREATE TABLE "cms"."ext_billing_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'Pricing',
  	"show_free_tier" boolean DEFAULT true,
  	"subheading" varchar DEFAULT 'Start free. Upgrade when you''re ready.',
  	"billing_toggle_default" "cms"."enum_ext_billing_settings_billing_toggle_default" DEFAULT 'monthly',
  	"free_tier_name" varchar DEFAULT 'Free',
  	"free_tier_description" varchar DEFAULT 'Everything you need to get started.',
  	"free_tier_cta_label" varchar DEFAULT 'Get started',
  	"free_tier_link_url" varchar,
  	"free_tier_link_new_tab" boolean DEFAULT false,
  	"disclaimer" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "cms"."ext_billing_settings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"ext_billing_plans_id" integer
  );
  
  CREATE TABLE "cms"."_ext_billing_settings_v_version_free_tier_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"included" boolean DEFAULT true,
  	"_uuid" varchar
  );
  
  CREATE TABLE "cms"."_ext_billing_settings_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_heading" varchar DEFAULT 'Pricing',
  	"version_show_free_tier" boolean DEFAULT true,
  	"version_subheading" varchar DEFAULT 'Start free. Upgrade when you''re ready.',
  	"version_billing_toggle_default" "cms"."enum__ext_billing_settings_v_version_billing_toggle_default" DEFAULT 'monthly',
  	"version_free_tier_name" varchar DEFAULT 'Free',
  	"version_free_tier_description" varchar DEFAULT 'Everything you need to get started.',
  	"version_free_tier_cta_label" varchar DEFAULT 'Get started',
  	"version_free_tier_link_url" varchar,
  	"version_free_tier_link_new_tab" boolean DEFAULT false,
  	"version_disclaimer" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."_ext_billing_settings_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"ext_billing_plans_id" integer
  );
  
  ALTER TABLE "cms"."plans_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."plans" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."coupons" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."coupons_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."subscriptions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."pricing_settings_free_tier_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."pricing_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."pricing_settings_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "cms"."plans_features" CASCADE;
  DROP TABLE "cms"."plans" CASCADE;
  DROP TABLE "cms"."coupons" CASCADE;
  DROP TABLE "cms"."coupons_rels" CASCADE;
  DROP TABLE "cms"."subscriptions" CASCADE;
  DROP TABLE "cms"."pricing_settings_free_tier_features" CASCADE;
  DROP TABLE "cms"."pricing_settings" CASCADE;
  DROP TABLE "cms"."pricing_settings_rels" CASCADE;
  ALTER TABLE "cms"."enrollments" DROP CONSTRAINT IF EXISTS "enrollments_subscription_id_subscriptions_id_fk";
  
  ALTER TABLE "cms"."series_rels" DROP CONSTRAINT IF EXISTS "series_rels_plans_fk";
  
  ALTER TABLE "cms"."_series_v_rels" DROP CONSTRAINT IF EXISTS "_series_v_rels_plans_fk";
  
  ALTER TABLE "cms"."space_groups_rels" DROP CONSTRAINT IF EXISTS "space_groups_rels_plans_fk";
  
  ALTER TABLE "cms"."community_spaces_rels" DROP CONSTRAINT IF EXISTS "community_spaces_rels_plans_fk";
  
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_plans_fk";
  
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_coupons_fk";
  
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_subscriptions_fk";
  
  DROP INDEX IF EXISTS "cms"."series_rels_plans_id_idx";
  DROP INDEX IF EXISTS "cms"."_series_v_rels_plans_id_idx";
  DROP INDEX IF EXISTS "cms"."space_groups_rels_plans_id_idx";
  DROP INDEX IF EXISTS "cms"."community_spaces_rels_plans_id_idx";
  DROP INDEX IF EXISTS "cms"."payload_locked_documents_rels_plans_id_idx";
  DROP INDEX IF EXISTS "cms"."payload_locked_documents_rels_coupons_id_idx";
  DROP INDEX IF EXISTS "cms"."payload_locked_documents_rels_subscriptions_id_idx";
  ALTER TABLE "cms"."series_rels" ADD COLUMN "ext_billing_plans_id" integer;
  ALTER TABLE "cms"."_series_v_rels" ADD COLUMN "ext_billing_plans_id" integer;
  ALTER TABLE "cms"."space_groups_rels" ADD COLUMN "ext_billing_plans_id" integer;
  ALTER TABLE "cms"."community_spaces_rels" ADD COLUMN "ext_billing_plans_id" integer;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN "ext_billing_plans_id" integer;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN "ext_billing_coupons_id" integer;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN "ext_billing_subscriptions_id" integer;
  ALTER TABLE "cms"."ext_billing_plans_features" ADD CONSTRAINT "ext_billing_plans_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."ext_billing_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."ext_billing_coupons_rels" ADD CONSTRAINT "ext_billing_coupons_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."ext_billing_coupons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."ext_billing_coupons_rels" ADD CONSTRAINT "ext_billing_coupons_rels_ext_billing_plans_fk" FOREIGN KEY ("ext_billing_plans_id") REFERENCES "cms"."ext_billing_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."ext_billing_subscriptions" ADD CONSTRAINT "ext_billing_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."ext_billing_subscriptions" ADD CONSTRAINT "ext_billing_subscriptions_plan_id_ext_billing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "cms"."ext_billing_plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."ext_billing_subscriptions" ADD CONSTRAINT "ext_billing_subscriptions_coupon_id_ext_billing_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "cms"."ext_billing_coupons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."ext_billing_settings_free_tier_features" ADD CONSTRAINT "ext_billing_settings_free_tier_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."ext_billing_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."ext_billing_settings_rels" ADD CONSTRAINT "ext_billing_settings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."ext_billing_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."ext_billing_settings_rels" ADD CONSTRAINT "ext_billing_settings_rels_ext_billing_plans_fk" FOREIGN KEY ("ext_billing_plans_id") REFERENCES "cms"."ext_billing_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_ext_billing_settings_v_version_free_tier_features" ADD CONSTRAINT "_ext_billing_settings_v_version_free_tier_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_ext_billing_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_ext_billing_settings_v_rels" ADD CONSTRAINT "_ext_billing_settings_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_ext_billing_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_ext_billing_settings_v_rels" ADD CONSTRAINT "_ext_billing_settings_v_rels_ext_billing_plans_fk" FOREIGN KEY ("ext_billing_plans_id") REFERENCES "cms"."ext_billing_plans"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "ext_billing_plans_features_order_idx" ON "cms"."ext_billing_plans_features" USING btree ("_order");
  CREATE INDEX "ext_billing_plans_features_parent_id_idx" ON "cms"."ext_billing_plans_features" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "ext_billing_plans_slug_idx" ON "cms"."ext_billing_plans" USING btree ("slug");
  CREATE INDEX "ext_billing_plans_updated_at_idx" ON "cms"."ext_billing_plans" USING btree ("updated_at");
  CREATE INDEX "ext_billing_plans_created_at_idx" ON "cms"."ext_billing_plans" USING btree ("created_at");
  CREATE INDEX "ext_billing_coupons_updated_at_idx" ON "cms"."ext_billing_coupons" USING btree ("updated_at");
  CREATE INDEX "ext_billing_coupons_created_at_idx" ON "cms"."ext_billing_coupons" USING btree ("created_at");
  CREATE INDEX "ext_billing_coupons_rels_order_idx" ON "cms"."ext_billing_coupons_rels" USING btree ("order");
  CREATE INDEX "ext_billing_coupons_rels_parent_idx" ON "cms"."ext_billing_coupons_rels" USING btree ("parent_id");
  CREATE INDEX "ext_billing_coupons_rels_path_idx" ON "cms"."ext_billing_coupons_rels" USING btree ("path");
  CREATE INDEX "ext_billing_coupons_rels_ext_billing_plans_id_idx" ON "cms"."ext_billing_coupons_rels" USING btree ("ext_billing_plans_id");
  CREATE INDEX "ext_billing_subscriptions_user_idx" ON "cms"."ext_billing_subscriptions" USING btree ("user_id");
  CREATE INDEX "ext_billing_subscriptions_plan_idx" ON "cms"."ext_billing_subscriptions" USING btree ("plan_id");
  CREATE INDEX "ext_billing_subscriptions_coupon_idx" ON "cms"."ext_billing_subscriptions" USING btree ("coupon_id");
  CREATE INDEX "ext_billing_subscriptions_status_idx" ON "cms"."ext_billing_subscriptions" USING btree ("status");
  CREATE UNIQUE INDEX "ext_billing_subscriptions_stripe_subscription_i_d_idx" ON "cms"."ext_billing_subscriptions" USING btree ("stripe_subscription_i_d");
  CREATE INDEX "ext_billing_subscriptions_stripe_customer_i_d_idx" ON "cms"."ext_billing_subscriptions" USING btree ("stripe_customer_i_d");
  CREATE INDEX "ext_billing_subscriptions_updated_at_idx" ON "cms"."ext_billing_subscriptions" USING btree ("updated_at");
  CREATE INDEX "ext_billing_subscriptions_created_at_idx" ON "cms"."ext_billing_subscriptions" USING btree ("created_at");
  CREATE INDEX "ext_billing_settings_free_tier_features_order_idx" ON "cms"."ext_billing_settings_free_tier_features" USING btree ("_order");
  CREATE INDEX "ext_billing_settings_free_tier_features_parent_id_idx" ON "cms"."ext_billing_settings_free_tier_features" USING btree ("_parent_id");
  CREATE INDEX "ext_billing_settings_rels_order_idx" ON "cms"."ext_billing_settings_rels" USING btree ("order");
  CREATE INDEX "ext_billing_settings_rels_parent_idx" ON "cms"."ext_billing_settings_rels" USING btree ("parent_id");
  CREATE INDEX "ext_billing_settings_rels_path_idx" ON "cms"."ext_billing_settings_rels" USING btree ("path");
  CREATE INDEX "ext_billing_settings_rels_ext_billing_plans_id_idx" ON "cms"."ext_billing_settings_rels" USING btree ("ext_billing_plans_id");
  CREATE INDEX "_ext_billing_settings_v_version_free_tier_features_order_idx" ON "cms"."_ext_billing_settings_v_version_free_tier_features" USING btree ("_order");
  CREATE INDEX "_ext_billing_settings_v_version_free_tier_features_parent_id_idx" ON "cms"."_ext_billing_settings_v_version_free_tier_features" USING btree ("_parent_id");
  CREATE INDEX "_ext_billing_settings_v_created_at_idx" ON "cms"."_ext_billing_settings_v" USING btree ("created_at");
  CREATE INDEX "_ext_billing_settings_v_updated_at_idx" ON "cms"."_ext_billing_settings_v" USING btree ("updated_at");
  CREATE INDEX "_ext_billing_settings_v_rels_order_idx" ON "cms"."_ext_billing_settings_v_rels" USING btree ("order");
  CREATE INDEX "_ext_billing_settings_v_rels_parent_idx" ON "cms"."_ext_billing_settings_v_rels" USING btree ("parent_id");
  CREATE INDEX "_ext_billing_settings_v_rels_path_idx" ON "cms"."_ext_billing_settings_v_rels" USING btree ("path");
  CREATE INDEX "_ext_billing_settings_v_rels_ext_billing_plans_id_idx" ON "cms"."_ext_billing_settings_v_rels" USING btree ("ext_billing_plans_id");
  ALTER TABLE "cms"."enrollments" ADD CONSTRAINT "enrollments_subscription_id_ext_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "cms"."ext_billing_subscriptions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."series_rels" ADD CONSTRAINT "series_rels_ext_billing_plans_fk" FOREIGN KEY ("ext_billing_plans_id") REFERENCES "cms"."ext_billing_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_series_v_rels" ADD CONSTRAINT "_series_v_rels_ext_billing_plans_fk" FOREIGN KEY ("ext_billing_plans_id") REFERENCES "cms"."ext_billing_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."space_groups_rels" ADD CONSTRAINT "space_groups_rels_ext_billing_plans_fk" FOREIGN KEY ("ext_billing_plans_id") REFERENCES "cms"."ext_billing_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."community_spaces_rels" ADD CONSTRAINT "community_spaces_rels_ext_billing_plans_fk" FOREIGN KEY ("ext_billing_plans_id") REFERENCES "cms"."ext_billing_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ext_billing_plans_fk" FOREIGN KEY ("ext_billing_plans_id") REFERENCES "cms"."ext_billing_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ext_billing_coupons_fk" FOREIGN KEY ("ext_billing_coupons_id") REFERENCES "cms"."ext_billing_coupons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ext_billing_subscriptions_fk" FOREIGN KEY ("ext_billing_subscriptions_id") REFERENCES "cms"."ext_billing_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "series_rels_ext_billing_plans_id_idx" ON "cms"."series_rels" USING btree ("ext_billing_plans_id");
  CREATE INDEX "_series_v_rels_ext_billing_plans_id_idx" ON "cms"."_series_v_rels" USING btree ("ext_billing_plans_id");
  CREATE INDEX "space_groups_rels_ext_billing_plans_id_idx" ON "cms"."space_groups_rels" USING btree ("ext_billing_plans_id");
  CREATE INDEX "community_spaces_rels_ext_billing_plans_id_idx" ON "cms"."community_spaces_rels" USING btree ("ext_billing_plans_id");
  CREATE INDEX "payload_locked_documents_rels_ext_billing_plans_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("ext_billing_plans_id");
  CREATE INDEX "payload_locked_documents_rels_ext_billing_coupons_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("ext_billing_coupons_id");
  CREATE INDEX "payload_locked_documents_rels_ext_billing_subscriptions__idx" ON "cms"."payload_locked_documents_rels" USING btree ("ext_billing_subscriptions_id");
  ALTER TABLE "cms"."series_rels" DROP COLUMN "plans_id";
  ALTER TABLE "cms"."_series_v_rels" DROP COLUMN "plans_id";
  ALTER TABLE "cms"."space_groups_rels" DROP COLUMN "plans_id";
  ALTER TABLE "cms"."community_spaces_rels" DROP COLUMN "plans_id";
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP COLUMN "plans_id";
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP COLUMN "coupons_id";
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP COLUMN "subscriptions_id";
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
  DROP TYPE "cms"."enum_pricing_settings_billing_toggle_default";`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
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
  CREATE TYPE "cms"."enum_pricing_settings_billing_toggle_default" AS ENUM('monthly', 'annual');
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
  
  CREATE TABLE "cms"."pricing_settings_free_tier_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"included" boolean DEFAULT true
  );
  
  CREATE TABLE "cms"."pricing_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'Pricing',
  	"show_free_tier" boolean DEFAULT true,
  	"subheading" varchar DEFAULT 'Start free. Upgrade when you''re ready.',
  	"billing_toggle_default" "cms"."enum_pricing_settings_billing_toggle_default" DEFAULT 'monthly',
  	"free_tier_name" varchar DEFAULT 'Free',
  	"free_tier_description" varchar DEFAULT 'Everything you need to get started.',
  	"free_tier_cta_label" varchar DEFAULT 'Get started',
  	"free_tier_link_url" varchar,
  	"free_tier_link_new_tab" boolean DEFAULT false,
  	"disclaimer" varchar,
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
  
  ALTER TABLE "cms"."ext_billing_plans_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."ext_billing_plans" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."ext_billing_coupons" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."ext_billing_coupons_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."ext_billing_subscriptions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."ext_billing_settings_free_tier_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."ext_billing_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."ext_billing_settings_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."_ext_billing_settings_v_version_free_tier_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."_ext_billing_settings_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."_ext_billing_settings_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "cms"."ext_billing_plans_features" CASCADE;
  DROP TABLE "cms"."ext_billing_plans" CASCADE;
  DROP TABLE "cms"."ext_billing_coupons" CASCADE;
  DROP TABLE "cms"."ext_billing_coupons_rels" CASCADE;
  DROP TABLE "cms"."ext_billing_subscriptions" CASCADE;
  DROP TABLE "cms"."ext_billing_settings_free_tier_features" CASCADE;
  DROP TABLE "cms"."ext_billing_settings" CASCADE;
  DROP TABLE "cms"."ext_billing_settings_rels" CASCADE;
  DROP TABLE "cms"."_ext_billing_settings_v_version_free_tier_features" CASCADE;
  DROP TABLE "cms"."_ext_billing_settings_v" CASCADE;
  DROP TABLE "cms"."_ext_billing_settings_v_rels" CASCADE;
  ALTER TABLE "cms"."enrollments" DROP CONSTRAINT IF EXISTS "enrollments_subscription_id_ext_billing_subscriptions_id_fk";
  
  ALTER TABLE "cms"."series_rels" DROP CONSTRAINT IF EXISTS "series_rels_ext_billing_plans_fk";
  
  ALTER TABLE "cms"."_series_v_rels" DROP CONSTRAINT IF EXISTS "_series_v_rels_ext_billing_plans_fk";
  
  ALTER TABLE "cms"."space_groups_rels" DROP CONSTRAINT IF EXISTS "space_groups_rels_ext_billing_plans_fk";
  
  ALTER TABLE "cms"."community_spaces_rels" DROP CONSTRAINT IF EXISTS "community_spaces_rels_ext_billing_plans_fk";
  
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_ext_billing_plans_fk";
  
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_ext_billing_coupons_fk";
  
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_ext_billing_subscriptions_fk";
  
  DROP INDEX IF EXISTS "cms"."series_rels_ext_billing_plans_id_idx";
  DROP INDEX IF EXISTS "cms"."_series_v_rels_ext_billing_plans_id_idx";
  DROP INDEX IF EXISTS "cms"."space_groups_rels_ext_billing_plans_id_idx";
  DROP INDEX IF EXISTS "cms"."community_spaces_rels_ext_billing_plans_id_idx";
  DROP INDEX IF EXISTS "cms"."payload_locked_documents_rels_ext_billing_plans_id_idx";
  DROP INDEX IF EXISTS "cms"."payload_locked_documents_rels_ext_billing_coupons_id_idx";
  DROP INDEX IF EXISTS "cms"."payload_locked_documents_rels_ext_billing_subscriptions__idx";
  ALTER TABLE "cms"."series_rels" ADD COLUMN "plans_id" integer;
  ALTER TABLE "cms"."_series_v_rels" ADD COLUMN "plans_id" integer;
  ALTER TABLE "cms"."space_groups_rels" ADD COLUMN "plans_id" integer;
  ALTER TABLE "cms"."community_spaces_rels" ADD COLUMN "plans_id" integer;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN "plans_id" integer;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN "coupons_id" integer;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN "subscriptions_id" integer;
  ALTER TABLE "cms"."plans_features" ADD CONSTRAINT "plans_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."coupons_rels" ADD CONSTRAINT "coupons_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."coupons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."coupons_rels" ADD CONSTRAINT "coupons_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "cms"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "cms"."plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."subscriptions" ADD CONSTRAINT "subscriptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "cms"."coupons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."pricing_settings_free_tier_features" ADD CONSTRAINT "pricing_settings_free_tier_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."pricing_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."pricing_settings_rels" ADD CONSTRAINT "pricing_settings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."pricing_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."pricing_settings_rels" ADD CONSTRAINT "pricing_settings_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "cms"."plans"("id") ON DELETE cascade ON UPDATE no action;
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
  CREATE INDEX "pricing_settings_free_tier_features_order_idx" ON "cms"."pricing_settings_free_tier_features" USING btree ("_order");
  CREATE INDEX "pricing_settings_free_tier_features_parent_id_idx" ON "cms"."pricing_settings_free_tier_features" USING btree ("_parent_id");
  CREATE INDEX "pricing_settings_rels_order_idx" ON "cms"."pricing_settings_rels" USING btree ("order");
  CREATE INDEX "pricing_settings_rels_parent_idx" ON "cms"."pricing_settings_rels" USING btree ("parent_id");
  CREATE INDEX "pricing_settings_rels_path_idx" ON "cms"."pricing_settings_rels" USING btree ("path");
  CREATE INDEX "pricing_settings_rels_plans_id_idx" ON "cms"."pricing_settings_rels" USING btree ("plans_id");
  ALTER TABLE "cms"."enrollments" ADD CONSTRAINT "enrollments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "cms"."subscriptions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."series_rels" ADD CONSTRAINT "series_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "cms"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_series_v_rels" ADD CONSTRAINT "_series_v_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "cms"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."space_groups_rels" ADD CONSTRAINT "space_groups_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "cms"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."community_spaces_rels" ADD CONSTRAINT "community_spaces_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "cms"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "cms"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_coupons_fk" FOREIGN KEY ("coupons_id") REFERENCES "cms"."coupons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscriptions_fk" FOREIGN KEY ("subscriptions_id") REFERENCES "cms"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "series_rels_plans_id_idx" ON "cms"."series_rels" USING btree ("plans_id");
  CREATE INDEX "_series_v_rels_plans_id_idx" ON "cms"."_series_v_rels" USING btree ("plans_id");
  CREATE INDEX "space_groups_rels_plans_id_idx" ON "cms"."space_groups_rels" USING btree ("plans_id");
  CREATE INDEX "community_spaces_rels_plans_id_idx" ON "cms"."community_spaces_rels" USING btree ("plans_id");
  CREATE INDEX "payload_locked_documents_rels_plans_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("plans_id");
  CREATE INDEX "payload_locked_documents_rels_coupons_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("coupons_id");
  CREATE INDEX "payload_locked_documents_rels_subscriptions_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("subscriptions_id");
  ALTER TABLE "cms"."series_rels" DROP COLUMN "ext_billing_plans_id";
  ALTER TABLE "cms"."_series_v_rels" DROP COLUMN "ext_billing_plans_id";
  ALTER TABLE "cms"."space_groups_rels" DROP COLUMN "ext_billing_plans_id";
  ALTER TABLE "cms"."community_spaces_rels" DROP COLUMN "ext_billing_plans_id";
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP COLUMN "ext_billing_plans_id";
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP COLUMN "ext_billing_coupons_id";
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP COLUMN "ext_billing_subscriptions_id";
  DROP TYPE "cms"."enum_ext_billing_plans_pricing_type";
  DROP TYPE "cms"."enum_ext_billing_plans_interval";
  DROP TYPE "cms"."enum_ext_billing_plans_intro_offer_intro_interval";
  DROP TYPE "cms"."enum_ext_billing_plans_entitlement";
  DROP TYPE "cms"."enum_ext_billing_plans_sync_status";
  DROP TYPE "cms"."enum_ext_billing_coupons_discount_type";
  DROP TYPE "cms"."enum_ext_billing_coupons_duration";
  DROP TYPE "cms"."enum_ext_billing_coupons_duration_unit";
  DROP TYPE "cms"."enum_ext_billing_coupons_sync_status";
  DROP TYPE "cms"."enum_ext_billing_subscriptions_status";
  DROP TYPE "cms"."enum_ext_billing_settings_billing_toggle_default";
  DROP TYPE "cms"."enum__ext_billing_settings_v_version_billing_toggle_default";`);
}
