/**
 * Server-boot instrumentation (https://nextjs.org/docs/app/guides/instrumentation).
 *
 * Two jobs, strictly ordered:
 *
 * 1. Runtime DB bootstrap (`lib/db/bootstrap.ts`): provisions a fresh hosted
 *    Supabase database — applies `supabase/migrations/*.sql` and creates the
 *    `cms` schema + `payload_cms` role — so a one-click deploy needs no manual
 *    `supabase db push` / SQL-editor step. Idempotent: a provisioned DB
 *    short-circuits, and it never throws (it logs and degrades to the manual
 *    flow instead).
 *
 * 2. Warms the Payload Local API once at startup so the first request never pays
 * Payload's multi-second init (DB connect + schema load) inside the render.
 * That slow path is more than a perf nit: when `generateMetadata` (which awaits
 * the CMS branding global) is still pending at the moment Next flushes the
 * shell, Next streams the metadata after the initial UI, and the emitted HTML
 * and RSC payload can disagree about where `<meta charset>` lives. React 19
 * then fails hydration at the first element of the public layout ("Hydration
 * failed … server rendered <meta charset> …") and regenerates the whole tree
 * on the client — reproducible in dev on the first page load after boot.
 * Warming the client keeps the theme/branding reads at millisecond latency, so
 * metadata always resolves with the shell and renders into `<head>`.
 */
export async function register() {
  // Payload (and its pg driver) only runs in the Node.js runtime — skip the
  // edge pass Next also runs this hook in. NEXT_RUNTIME is set by Next itself
  // (not deployment config), so it lives outside the zod env schema and turbo's
  // globalEnv; this is the guard Next's instrumentation docs prescribe.
  // eslint-disable-next-line no-restricted-properties, turbo/no-undeclared-env-vars
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // DB bootstrap FIRST: the warm-up below is what triggers Payload's
  // `prodMigrations`, which need the `cms` schema + `payload_cms` role this
  // creates. Handles its own errors — never throws.
  const { bootstrapDatabase } = await import("~/lib/db/bootstrap");
  await bootstrapDatabase();

  try {
    // The init lock serializes the warm-up ACROSS instances: on serverless,
    // concurrent cold boots otherwise race `createExtensions` + the
    // `prodMigrations` ledger (see lib/cms/init-lock.ts).
    const [{ default: config }, { getPayload }, { withCmsInitLock }] =
      await Promise.all([
        import("@payload-config"),
        import("payload"),
        import("~/lib/cms/init-lock"),
      ]);
    await withCmsInitLock(() => getPayload({ config }));
  } catch {
    // CMS unreachable (e.g. local Postgres not running) — fine: the public
    // pages' fetchers (lib/payload.ts) degrade to built-in defaults on their own.
  }
}
