import path from "node:path";
import { fileURLToPath } from "node:url";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { seoPlugin } from "@payloadcms/plugin-seo";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { s3Storage } from "@payloadcms/storage-s3";
import { buildConfig } from "payload";
import sharp from "sharp";

import { Articles } from "./payload/collections/Articles";
import { Audio } from "./payload/collections/Audio";
import { Events } from "./payload/collections/Events";
import { Locations } from "./payload/collections/Locations";
import { Media } from "./payload/collections/Media";
import { Pages } from "./payload/collections/Pages";
import { Photos } from "./payload/collections/Photos";
import { Users } from "./payload/collections/Users";
import { Videos } from "./payload/collections/Videos";
import { SiteSettings } from "./payload/globals/SiteSettings";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default buildConfig({
  // Payload's own admin auth (content editors), separate from Supabase Auth.
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname, "app/(payload)") },
  },
  // Admin at /admin; REST API moved OFF /api to /cms-api so it never collides
  // with the app's existing /api/chat, /api/stripe/*, /api/push/* routes.
  routes: {
    admin: "/admin",
    api: "/cms-api",
  },
  collections: [
    Users,
    Media,
    Articles,
    Events,
    Videos,
    Audio,
    Photos,
    Locations,
    Pages,
  ],
  globals: [SiteSettings],
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
    // Reproducible schema: commit Payload migrations (`pnpm cms:migrate`); don't
    // auto-`push` (mirrors the Supabase-migrations discipline).
    push: false,
    migrationDir: path.resolve(dirname, "payload/migrations"),
  }),
  sharp,
  plugins: [
    s3Storage({
      collections: { media: true },
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
      collections: ["pages", "articles"],
      uploadsCollection: "media",
    }),
  ],
});
