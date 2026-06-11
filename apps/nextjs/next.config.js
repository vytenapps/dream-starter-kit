import { withPayload } from "@payloadcms/next/withPayload";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
await jiti.import("./src/env");

/** @type {import("next").NextConfig} */
const config = {
  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@acme/api",
    "@acme/app",
    "@acme/cms",
    "@acme/config",
    "@acme/ui",
  ],

  /** We already do linting and typechecking as separate tasks in CI */
  typescript: { ignoreBuildErrors: true },

  /**
   * `pg` (the runtime DB bootstrap's driver, lib/db/bootstrap.ts) must stay a
   * Node require — bundling trips on its optional native `pg-native` import.
   */
  serverExternalPackages: ["pg"],
};

// `withPayload` mounts the Payload admin (/admin) + REST API. Payload's admin has
// historically expected the webpack build path — if the admin fails to compile under
// Next's default bundler, run the web app with `next dev --webpack` / `next build --webpack`.
export default withPayload(config);
