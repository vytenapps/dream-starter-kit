/**
 * Server-boot instrumentation (https://nextjs.org/docs/app/guides/instrumentation).
 *
 * Two jobs:
 *
 * 1. Runtime DB bootstrap (`lib/db/bootstrap.ts`): provisions a fresh hosted
 *    Supabase database — applies `supabase/migrations/*.sql` and creates the
 *    `cms` schema + `payload_cms` role — so a one-click deploy needs no manual
 *    `supabase db push` / SQL-editor step. Idempotent: a provisioned DB
 *    short-circuits, and it never throws (it logs and degrades to the manual
 *    flow instead). We hand it the CMS warm-up (job 2) as `migrateCms` so
 *    Payload's first-boot `prodMigrations` run INSIDE the bootstrap's
 *    cross-instance advisory lock — serialized across cold-starting instances
 *    and never at request time (a failed migration's `process.exit(1)` would
 *    otherwise crash whatever request triggered it into a 500).
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

  // `next build` runs this hook in its prerender workers too, but both jobs are
  // runtime concerns: provisioning mutates the database (and preview/CI builds
  // may have no DB access at all), and on a fresh project the warm-up would
  // just log Payload's "cannot connect to Postgres" into the build output —
  // the payload_cms role it connects with is created at first server BOOT, one
  // step below. NEXT_PHASE is set by Next itself, so it lives outside the zod
  // env schema (same as NEXT_RUNTIME above).
  // eslint-disable-next-line no-restricted-properties, turbo/no-undeclared-env-vars
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // The CMS warm-up: initialize Payload (its `getPayload()` runs the
  // `prodMigrations` on first connect) and reconcile the extension registry +
  // CMS-driven menu from the bundled generated defaults (lib/ext/reconcile-nav)
  // — insert rows for newly installed extensions, drop removed ones, never
  // touch staff edits.
  const warmCms = async () => {
    const [{ default: config }, { getPayload }] = await Promise.all([
      import("@payload-config"),
      import("payload"),
    ]);
    const payload = await getPayload({ config });
    const { reconcileExtensions } = await import("~/lib/ext/reconcile-nav");
    await reconcileExtensions(payload);
  };

  // Bundled Payload migration names — so the bootstrap can spot a pending CMS
  // migration (fresh DB, or a deploy that added one) and run `warmCms` under
  // its advisory lock. Resolved best-effort; missing names just disable that
  // detection (the bootstrap still provisions and warms).
  const cmsMigrationNames = await (async () => {
    try {
      const [{ migrations }, { extPayloadMigrations }] = await Promise.all([
        import("./payload/migrations"),
        import("./ext/registry.payload.generated"),
      ]);
      return [...migrations, ...extPayloadMigrations].map((m) => m.name);
    } catch {
      return undefined;
    }
  })();

  // DB bootstrap runs the CMS migration UNDER its cross-instance advisory lock
  // (via `migrateCms`), so the first-boot `prodMigrations` is serialized across
  // cold-starting instances and never races at request time — where a failed
  // migration's `process.exit(1)` surfaces as a Vercel FUNCTION_INVOCATION_FAILED
  // 500 (e.g. the `/welcome` redirect on a fresh deploy). Handles its own
  // errors — never throws.
  const { bootstrapDatabase } = await import("~/lib/db/bootstrap");
  const result = await bootstrapDatabase({
    migrateCms: warmCms,
    cmsMigrationNames,
  });

  // Fast path: a fully-provisioned, fully-migrated DB skips the lock and the
  // warm-up. Warm Payload now (unlocked is safe — no migration is pending, so
  // concurrent runs just read the ledger) so the first request doesn't pay
  // Payload's multi-second init.
  if (!result.cmsWarmed) {
    try {
      await warmCms();
    } catch {
      // CMS unreachable (e.g. local Postgres not running) — fine: the public
      // pages' fetchers (lib/payload.ts) degrade to built-in defaults on their own.
    }
  }
}
