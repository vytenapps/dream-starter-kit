import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "cms"."enum_authentication_settings_login_methods_method" AS ENUM('password', 'magicLink', 'emailOtp', 'google', 'apple', 'sso');
  CREATE TYPE "cms"."enum_authentication_settings_email_domain_mode" AS ENUM('off', 'allowlist', 'blocklist');
  CREATE TABLE "cms"."authentication_settings_login_methods" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"method" "cms"."enum_authentication_settings_login_methods_method" NOT NULL,
  	"enabled" boolean DEFAULT false
  );
  
  CREATE TABLE "cms"."authentication_settings_email_domains" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"domain" varchar
  );
  
  CREATE TABLE "cms"."authentication_settings_sso_domains" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"domain" varchar NOT NULL,
  	"provider_id" varchar
  );
  
  CREATE TABLE "cms"."authentication_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"allow_signups" boolean DEFAULT true,
  	"email_domain_mode" "cms"."enum_authentication_settings_email_domain_mode" DEFAULT 'off',
  	"terms_url" varchar DEFAULT '/terms',
  	"privacy_url" varchar DEFAULT '/privacy',
  	"require_terms_acceptance" boolean DEFAULT false,
  	"post_login_redirect" varchar,
  	"post_signup_redirect" varchar,
  	"min_password_length" numeric DEFAULT 8,
  	"require_captcha" boolean DEFAULT false,
  	"sign_in_heading" varchar,
  	"sign_up_heading" varchar,
  	"subtitle" varchar,
  	"sso_button_label" varchar DEFAULT 'Continue with SAML SSO',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "cms"."ext_billing_settings_enterprise_tier_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"included" boolean DEFAULT true
  );
  
  CREATE TABLE "cms"."_ext_billing_settings_v_version_enterprise_tier_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"included" boolean DEFAULT true,
  	"_uuid" varchar
  );
  
  ALTER TABLE "cms"."reviews" ADD COLUMN "author_title" varchar;
  ALTER TABLE "cms"."ext_billing_settings" ADD COLUMN "show_enterprise_tier" boolean DEFAULT true;
  ALTER TABLE "cms"."ext_billing_settings" ADD COLUMN "enterprise_tier_name" varchar DEFAULT 'Enterprise';
  ALTER TABLE "cms"."ext_billing_settings" ADD COLUMN "enterprise_tier_description" varchar DEFAULT 'Total access for your whole team, billed your way.';
  ALTER TABLE "cms"."ext_billing_settings" ADD COLUMN "enterprise_tier_cta_label" varchar DEFAULT 'Contact sales';
  ALTER TABLE "cms"."ext_billing_settings" ADD COLUMN "enterprise_tier_link_url" varchar;
  ALTER TABLE "cms"."ext_billing_settings" ADD COLUMN "enterprise_tier_link_new_tab" boolean DEFAULT false;
  ALTER TABLE "cms"."ext_billing_settings" ADD COLUMN "featured_review_id" integer;
  ALTER TABLE "cms"."_ext_billing_settings_v" ADD COLUMN "version_show_enterprise_tier" boolean DEFAULT true;
  ALTER TABLE "cms"."_ext_billing_settings_v" ADD COLUMN "version_enterprise_tier_name" varchar DEFAULT 'Enterprise';
  ALTER TABLE "cms"."_ext_billing_settings_v" ADD COLUMN "version_enterprise_tier_description" varchar DEFAULT 'Total access for your whole team, billed your way.';
  ALTER TABLE "cms"."_ext_billing_settings_v" ADD COLUMN "version_enterprise_tier_cta_label" varchar DEFAULT 'Contact sales';
  ALTER TABLE "cms"."_ext_billing_settings_v" ADD COLUMN "version_enterprise_tier_link_url" varchar;
  ALTER TABLE "cms"."_ext_billing_settings_v" ADD COLUMN "version_enterprise_tier_link_new_tab" boolean DEFAULT false;
  ALTER TABLE "cms"."_ext_billing_settings_v" ADD COLUMN "version_featured_review_id" integer;
  ALTER TABLE "cms"."authentication_settings_login_methods" ADD CONSTRAINT "authentication_settings_login_methods_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."authentication_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."authentication_settings_email_domains" ADD CONSTRAINT "authentication_settings_email_domains_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."authentication_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."authentication_settings_sso_domains" ADD CONSTRAINT "authentication_settings_sso_domains_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."authentication_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."ext_billing_settings_enterprise_tier_features" ADD CONSTRAINT "ext_billing_settings_enterprise_tier_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."ext_billing_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_ext_billing_settings_v_version_enterprise_tier_features" ADD CONSTRAINT "_ext_billing_settings_v_version_enterprise_tier_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_ext_billing_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "authentication_settings_login_methods_order_idx" ON "cms"."authentication_settings_login_methods" USING btree ("_order");
  CREATE INDEX "authentication_settings_login_methods_parent_id_idx" ON "cms"."authentication_settings_login_methods" USING btree ("_parent_id");
  CREATE INDEX "authentication_settings_email_domains_order_idx" ON "cms"."authentication_settings_email_domains" USING btree ("_order");
  CREATE INDEX "authentication_settings_email_domains_parent_id_idx" ON "cms"."authentication_settings_email_domains" USING btree ("_parent_id");
  CREATE INDEX "authentication_settings_sso_domains_order_idx" ON "cms"."authentication_settings_sso_domains" USING btree ("_order");
  CREATE INDEX "authentication_settings_sso_domains_parent_id_idx" ON "cms"."authentication_settings_sso_domains" USING btree ("_parent_id");
  CREATE INDEX "ext_billing_settings_enterprise_tier_features_order_idx" ON "cms"."ext_billing_settings_enterprise_tier_features" USING btree ("_order");
  CREATE INDEX "ext_billing_settings_enterprise_tier_features_parent_id_idx" ON "cms"."ext_billing_settings_enterprise_tier_features" USING btree ("_parent_id");
  CREATE INDEX "_ext_billing_settings_v_version_enterprise_tier_features_order_idx" ON "cms"."_ext_billing_settings_v_version_enterprise_tier_features" USING btree ("_order");
  CREATE INDEX "_ext_billing_settings_v_version_enterprise_tier_features_parent_id_idx" ON "cms"."_ext_billing_settings_v_version_enterprise_tier_features" USING btree ("_parent_id");
  ALTER TABLE "cms"."ext_billing_settings" ADD CONSTRAINT "ext_billing_settings_featured_review_id_reviews_id_fk" FOREIGN KEY ("featured_review_id") REFERENCES "cms"."reviews"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_ext_billing_settings_v" ADD CONSTRAINT "_ext_billing_settings_v_version_featured_review_id_reviews_id_fk" FOREIGN KEY ("version_featured_review_id") REFERENCES "cms"."reviews"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "ext_billing_settings_featured_review_idx" ON "cms"."ext_billing_settings" USING btree ("featured_review_id");
  CREATE INDEX "_ext_billing_settings_v_version_version_featured_review_idx" ON "cms"."_ext_billing_settings_v" USING btree ("version_featured_review_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cms"."authentication_settings_login_methods" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."authentication_settings_email_domains" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."authentication_settings_sso_domains" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."authentication_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."ext_billing_settings_enterprise_tier_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."_ext_billing_settings_v_version_enterprise_tier_features" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "cms"."authentication_settings_login_methods" CASCADE;
  DROP TABLE "cms"."authentication_settings_email_domains" CASCADE;
  DROP TABLE "cms"."authentication_settings_sso_domains" CASCADE;
  DROP TABLE "cms"."authentication_settings" CASCADE;
  DROP TABLE "cms"."ext_billing_settings_enterprise_tier_features" CASCADE;
  DROP TABLE "cms"."_ext_billing_settings_v_version_enterprise_tier_features" CASCADE;
  ALTER TABLE "cms"."ext_billing_settings" DROP CONSTRAINT "ext_billing_settings_featured_review_id_reviews_id_fk";
  
  ALTER TABLE "cms"."_ext_billing_settings_v" DROP CONSTRAINT "_ext_billing_settings_v_version_featured_review_id_reviews_id_fk";
  
  DROP INDEX "cms"."ext_billing_settings_featured_review_idx";
  DROP INDEX "cms"."_ext_billing_settings_v_version_version_featured_review_idx";
  ALTER TABLE "cms"."reviews" DROP COLUMN "author_title";
  ALTER TABLE "cms"."ext_billing_settings" DROP COLUMN "show_enterprise_tier";
  ALTER TABLE "cms"."ext_billing_settings" DROP COLUMN "enterprise_tier_name";
  ALTER TABLE "cms"."ext_billing_settings" DROP COLUMN "enterprise_tier_description";
  ALTER TABLE "cms"."ext_billing_settings" DROP COLUMN "enterprise_tier_cta_label";
  ALTER TABLE "cms"."ext_billing_settings" DROP COLUMN "enterprise_tier_link_url";
  ALTER TABLE "cms"."ext_billing_settings" DROP COLUMN "enterprise_tier_link_new_tab";
  ALTER TABLE "cms"."ext_billing_settings" DROP COLUMN "featured_review_id";
  ALTER TABLE "cms"."_ext_billing_settings_v" DROP COLUMN "version_show_enterprise_tier";
  ALTER TABLE "cms"."_ext_billing_settings_v" DROP COLUMN "version_enterprise_tier_name";
  ALTER TABLE "cms"."_ext_billing_settings_v" DROP COLUMN "version_enterprise_tier_description";
  ALTER TABLE "cms"."_ext_billing_settings_v" DROP COLUMN "version_enterprise_tier_cta_label";
  ALTER TABLE "cms"."_ext_billing_settings_v" DROP COLUMN "version_enterprise_tier_link_url";
  ALTER TABLE "cms"."_ext_billing_settings_v" DROP COLUMN "version_enterprise_tier_link_new_tab";
  ALTER TABLE "cms"."_ext_billing_settings_v" DROP COLUMN "version_featured_review_id";
  DROP TYPE "cms"."enum_authentication_settings_login_methods_method";
  DROP TYPE "cms"."enum_authentication_settings_email_domain_mode";`)
}
