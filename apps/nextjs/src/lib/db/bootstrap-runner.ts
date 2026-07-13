/**
 * Composition + re-run gate for the runtime DB bootstrap (./bootstrap.ts).
 *
 * `runFullBootstrap` assembles the Payload-aware pieces the bootstrap itself
 * must stay free of — the CMS warm-up (`getPayload()` runs `prodMigrations` on
 * first connect, then the extension/nav reconcile) and the bundled Payload
 * migration names — and runs the bootstrap single-flight per process. It's
 * what instrumentation.ts used to assemble inline at boot.
 *
 * `ensureDbProvisioned` is the REQUEST-PATH recovery seam. The boot-time
 * bootstrap gets exactly one shot per instance; when it fails (a just-created
 * Supabase project not accepting connections yet, a pooler hiccup), every
 * warm instance used to serve a broken app for its whole life — Payload kept
 * connecting as the never-created `payload_cms` role, Supavisor's failed
 * credential lookups tripped its circuit breaker ("ECIRCUITBREAKER … new
 * connections are temporarily blocked"), and THAT blocked the very session
 * connections later cold-start bootstraps needed: a self-sustaining outage
 * ending in a 503 on the founder's first `/welcome`. This gate lets request
 * paths retry the full bootstrap — single-flight, cooldown-limited so a
 * down database sees one calm session-connect attempt per interval instead
 * of a storm — and report the (possibly healed) status.
 *
 * State lives on `globalThis` (same rationale as bootstrap-status.ts): `next
 * dev` can duplicate this module across the instrumentation and route bundles.
 */
import type { BootstrapResult } from "./bootstrap";
import type { BootstrapStatus } from "./bootstrap-status";
import { bootstrapDatabase } from "./bootstrap";
import { getBootstrapStatus } from "./bootstrap-status";

/** Min gap between failed-bootstrap retries from request paths. */
export const PROVISION_RETRY_COOLDOWN_MS = 30_000;

/**
 * Initialize Payload (first `getPayload()` runs the committed `prodMigrations`)
 * and reconcile the extension registry + CMS-driven menu from the bundled
 * generated defaults — insert rows for newly installed extensions, drop removed
 * ones, never touch staff edits. Runs under the bootstrap's advisory lock when
 * invoked as its `migrateCms`. Everything is imported dynamically so DB-less
 * boots (and unit tests) never load Payload.
 */
export async function warmCms(): Promise<void> {
  const [{ default: config }, { getPayload }] = await Promise.all([
    import("@payload-config"),
    import("payload"),
  ]);
  const payload = await getPayload({ config });
  const { reconcileExtensions } = await import("../ext/reconcile-nav");
  await reconcileExtensions(payload);
}

/**
 * Bundled Payload migration names — so the bootstrap can spot a pending CMS
 * migration (fresh DB, or a deploy that added one) and run `warmCms` under its
 * advisory lock. Resolved best-effort; missing names just disable that
 * detection (the bootstrap still provisions and warms).
 */
async function resolveCmsMigrationNames(): Promise<string[] | undefined> {
  try {
    const [{ migrations }, { extPayloadMigrations }] = await Promise.all([
      import("../../payload/migrations"),
      import("../../ext/registry.payload.generated"),
    ]);
    return [...migrations, ...extPayloadMigrations].map((m) => m.name);
  } catch {
    return undefined;
  }
}

interface RunnerState {
  inFlight?: Promise<BootstrapResult>;
  lastAttemptAt?: number;
}

const GLOBAL_KEY = "__dreamStarterKitDbBootstrapRunner";

interface GlobalWithRunner {
  [GLOBAL_KEY]?: RunnerState;
}

function runnerState(): RunnerState {
  const g = globalThis as GlobalWithRunner;
  return (g[GLOBAL_KEY] ??= {});
}

/** Test seam: drop the single-flight/cooldown state. */
export function resetBootstrapRunner(): void {
  delete (globalThis as GlobalWithRunner)[GLOBAL_KEY];
}

export interface BootstrapRunnerDeps {
  /** The bootstrap invocation — defaults to the real, fully-wired one. */
  bootstrap?: () => Promise<BootstrapResult>;
  now?: () => number;
}

async function defaultBootstrap(): Promise<BootstrapResult> {
  return bootstrapDatabase({
    migrateCms: warmCms,
    cmsMigrationNames: await resolveCmsMigrationNames(),
  });
}

/**
 * The full runtime bootstrap (supabase migrations + cms role + Payload
 * migrations under one lock), single-flight per process. Concurrent callers
 * share the in-flight run. Like `bootstrapDatabase`, it resolves rather than
 * throws on failure — the outcome lands in `getBootstrapStatus()`.
 */
export function runFullBootstrap(
  deps: BootstrapRunnerDeps = {},
): Promise<BootstrapResult> {
  const state = runnerState();
  if (state.inFlight) return state.inFlight;
  state.lastAttemptAt = (deps.now ?? Date.now)();
  state.inFlight = (deps.bootstrap ?? defaultBootstrap)().finally(() => {
    state.inFlight = undefined;
  });
  return state.inFlight;
}

/**
 * Request-path recovery: when this instance's bootstrap FAILED, retry it —
 * single-flight, and at most once per {@link PROVISION_RETRY_COOLDOWN_MS} so
 * an unreachable database sees one session-connect attempt per interval, not
 * one per request. Any other status (ok, up-to-date, opt-out, no-url,
 * build-phase, not-run) passes straight through: those are either healthy or
 * deliberate, and re-running wouldn't change them. Returns the latest status
 * so callers can decide whether the CMS is safe to touch.
 */
export async function ensureDbProvisioned(
  deps: BootstrapRunnerDeps = {},
): Promise<BootstrapStatus> {
  const state = runnerState();
  if (state.inFlight) {
    await state.inFlight;
    return getBootstrapStatus();
  }
  const status = getBootstrapStatus();
  if (status.status !== "error") return status;
  const now = (deps.now ?? Date.now)();
  if (
    state.lastAttemptAt !== undefined &&
    now - state.lastAttemptAt < PROVISION_RETRY_COOLDOWN_MS
  ) {
    return status;
  }
  await runFullBootstrap(deps);
  return getBootstrapStatus();
}
