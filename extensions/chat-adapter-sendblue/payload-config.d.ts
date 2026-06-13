// The host app aliases "@payload-config" to its payload.config.ts (withPayload
// does the same at build time, so the import resolves at runtime inside the
// Next bundle). Typecheck-side we declare the module instead of path-mapping
// to the real file — that would pull the whole host TS program in here.
declare module "@payload-config" {
  import type { SanitizedConfig } from "payload";

  const config: Promise<SanitizedConfig>;
  export default config;
}
