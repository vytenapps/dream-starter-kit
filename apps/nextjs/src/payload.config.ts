import path from "node:path";
import { fileURLToPath } from "node:url";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { formBuilderPlugin } from "@payloadcms/plugin-form-builder";
import { nestedDocsPlugin } from "@payloadcms/plugin-nested-docs";
import { seoPlugin } from "@payloadcms/plugin-seo";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { s3Storage } from "@payloadcms/storage-s3";
import { buildConfig } from "payload";
import sharp from "sharp";

import { isStaff } from "./payload/access";
import { Audio } from "./payload/collections/Audio";
import { Banners } from "./payload/collections/Banners";
import { Categories } from "./payload/collections/Categories";
import { Comments } from "./payload/collections/Comments";
import { CommunityPosts } from "./payload/collections/CommunityPosts";
import { CommunitySpaces } from "./payload/collections/CommunitySpaces";
import { Coupons } from "./payload/collections/Coupons";
import { DeviceTokens } from "./payload/collections/DeviceTokens";
import { Enrollments } from "./payload/collections/Enrollments";
import { Events } from "./payload/collections/Events";
import { Favorites } from "./payload/collections/Favorites";
import { FeedTokens } from "./payload/collections/FeedTokens";
import { Lessons } from "./payload/collections/Lessons";
import { Locations } from "./payload/collections/Locations";
import { Media } from "./payload/collections/Media";
import { Notifications } from "./payload/collections/Notifications";
import { Onboarding } from "./payload/collections/Onboarding";
import { Pages } from "./payload/collections/Pages";
import { Photos } from "./payload/collections/Photos";
import { Plans } from "./payload/collections/Plans";
import { Posts } from "./payload/collections/Posts";
import { Reports } from "./payload/collections/Reports";
import { Reviews } from "./payload/collections/Reviews";
import { Series } from "./payload/collections/Series";
import { SpaceGroups } from "./payload/collections/SpaceGroups";
import { TagGroups, Tags } from "./payload/collections/Tags";
import { Users } from "./payload/collections/Users";
import { Videos } from "./payload/collections/Videos";
import { PricingSettings } from "./payload/globals/PricingSettings";
import { ProfileFields } from "./payload/globals/ProfileFields";
import { SiteSettings } from "./payload/globals/SiteSettings";
import { ThemeSettings } from "./payload/globals/ThemeSettings";
import { migrations } from "./payload/migrations";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default buildConfig({
  // Payload's own admin auth (content editors), separate from Supabase Auth.
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname, "app/(payload)") },
    // Favicon set for the /admin chrome (same RealFaviconGenerator output in
    // /public). Payload's meta extends Next.js Metadata, so we declare the SVG +
    // PNG + apple-touch icons explicitly rather than relying on Payload's default.
    meta: {
      titleSuffix: "· Admin",
      icons: [
        { rel: "icon", type: "image/x-icon", url: "/favicon.ico" },
        { rel: "icon", type: "image/svg+xml", url: "/favicon.svg" },
        {
          rel: "icon",
          type: "image/png",
          sizes: "96x96",
          url: "/favicon-96x96.png",
        },
        {
          rel: "apple-touch-icon",
          sizes: "180x180",
          url: "/apple-touch-icon.png",
        },
      ],
    },
    components: {
      // Replace Payload's default mark in the admin chrome (step-nav home icon)
      // with the brand favicon, same as the public header/footer. See
      // payload/components/BrandIcon.tsx.
      graphics: { Icon: "~/payload/components/BrandIcon#BrandIcon" },
      // On first boot (no content yet) this redirects the freshly-created admin
      // to /cms-setup, which seeds demo content with a progress bar. Self-
      // disables once the CMS has content. See payload/components/SeedGate.tsx.
      beforeDashboard: ["~/payload/components/SeedGate#SeedGate"],
      // Wraps every admin route and injects the site-wide shadcn theme as a
      // <style> (from the theme-settings global) so the admin chrome follows the
      // same theme as the front end. See payload/components/ThemeStyleProvider.tsx.
      providers: ["~/payload/components/ThemeStyleProvider#ThemeStyleProvider"],
      // CMS auth is SSO from the Supabase session (no payload-token), so the
      // default logout can't end the session. Replace it with one that signs out
      // of Supabase and returns to the host root. See payload/components/LogoutButton.tsx.
      logout: { Button: "~/payload/components/LogoutButton#LogoutButton" },
    },
  },
  // Admin at /admin; REST API moved OFF /api to /cms-api so it never collides
  // with the app's existing /api/chat, /api/stripe/*, /api/push/* routes.
  routes: {
    admin: "/admin",
    api: "/cms-api",
  },
  collections: [
    // People
    Users,
    DeviceTokens,
    FeedTokens,
    Favorites,
    Enrollments,
    Reviews,
    // Content
    Media,
    Posts,
    Videos,
    Audio,
    Photos,
    Series,
    Lessons,
    Locations,
    Events,
    Categories,
    Tags,
    TagGroups,
    // Community
    SpaceGroups,
    CommunitySpaces,
    CommunityPosts,
    Comments,
    Reports,
    // Commerce
    Plans,
    Coupons,
    // Marketing
    Pages,
    Onboarding,
    Banners,
    Notifications,
  ],
  globals: [SiteSettings, ThemeSettings, PricingSettings, ProfileFields],
  // One shared, cross-collection folder tree ("Browse by Folder") for the
  // collections that enable `folders: true`.
  folders: { browseByFolder: true },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET ?? "",
  // Generated types are published from the @acme/cms package so the Expo app and
  // shared hooks can import them without pulling in Payload's Node runtime.
  typescript: {
    // Don't emit the `declare module 'payload'` augmentation into the shared
    // types package — that would force `payload` to be a dependency of
    // @acme/cms and the Expo app. We re-declare it locally where Payload's
    // Local API is used: apps/nextjs/src/payload-augment.d.ts.
    declare: false,
    outputFile: path.resolve(
      dirname,
      "../../../packages/cms/src/payload-types.ts",
    ),
  },
  db: postgresAdapter({
    pool: { connectionString: process.env.PAYLOAD_DATABASE_URL },
    // Payload owns its own Postgres schema, isolated from the RLS-governed
    // `public` tables. It connects as the least-privilege `payload_cms` role.
    schemaName: "cms",
    // Dev/CI auto-creates the cms tables via dev "push" (so a fresh clone needs
    // no migration step). In production (NODE_ENV=production) push is OFF; instead
    // Payload runs `prodMigrations` automatically on first connect, so a fresh
    // prod database self-provisions the cms schema on the first request — no
    // separate `pnpm cms:migrate` deploy step required (it stays idempotent via
    // the cms.payload_migrations ledger). After changing a collection, regenerate
    // with `pnpm cms:migrate:create` and commit the new file in payload/migrations.
    push: process.env.NODE_ENV !== "production",
    prodMigrations: migrations,
    migrationDir: path.resolve(dirname, "payload/migrations"),
  }),
  sharp,
  plugins: [
    s3Storage({
      // photos + audio are upload collections in their own right (the app's
      // Photos/Podcast sections); prefixes keep their objects separated from
      // the general media store inside the one bucket.
      collections: {
        media: true,
        photos: { prefix: "photos" },
        audio: { prefix: "audio" },
      },
      bucket: process.env.S3_BUCKET ?? "cms-media",
      config: {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION,
        forcePathStyle: true, // required for Supabase's S3-compatible endpoint
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
        },
      },
    }),
    seoPlugin({
      collections: [
        "posts",
        "videos",
        "audio",
        "photos",
        "pages",
        "events",
        "locations",
        "series",
      ],
      uploadsCollection: "media",
    }),
    // Hierarchies (parent + auto-maintained breadcrumbs) for taxonomy, page
    // trees and community space groups.
    nestedDocsPlugin({
      collections: ["categories", "pages", "space-groups"],
    }),
    formBuilderPlugin({
      fields: {
        text: true,
        textarea: true,
        email: true,
        select: true,
        checkbox: true,
        number: true,
        message: true,
        country: false,
        state: false,
        payment: false,
      },
      redirectRelationships: ["pages"],
      formOverrides: { admin: { group: "Marketing" } },
      formSubmissionOverrides: {
        admin: { group: "Marketing" },
        access: { read: isStaff, delete: isStaff },
      },
    }),
  ],
});
