/**
 * Guarded access to the Payload Local API — `getPayloadClient()` instead of a
 * bare `getPayload({ config })` on every request path (page fetchers, the auth
 * mirror, cron/API routes).
 *
 * Why a guard exists at all: until the runtime DB bootstrap has provisioned a
 * fresh database, the `payload_cms` role Payload connects with DOES NOT EXIST.
 * Every connection attempt then fails inside Supavisor's credential lookup
 * ("EAUTHQUERY user not found in the database"), and enough of them trip its
 * credential circuit breaker ("ECIRCUITBREAKER … new connections are
 * temporarily blocked") — which also blocks the privileged session connections
 * the bootstrap itself needs, so provisioning can never succeed and a fresh
 * one-click deploy stays broken until a human intervenes. Observed exactly so
 * in production on a Vercel + Supabase-integration first deploy.
 *
 * The guard breaks that loop three ways:
 *
 *   1. Heal-first: when this instance's boot bootstrap FAILED, re-run it
 *      (single-flight + cooldown via lib/db/bootstrap-runner.ts) BEFORE
 *      touching the Payload pool — the retry connects as the privileged
 *      `postgres` user and creates the role/migrations, after which Payload
 *      can actually connect.
 *   2. Failure cooldown: after a Payload init failure, further calls fail
 *      fast (CmsUnavailableError) for {@link CMS_FAILURE_COOLDOWN_MS} instead
 *      of re-hammering the pooler once per render. Callers already treat any
 *      throw as "CMS unavailable" and degrade (lib/payload.ts `safe()`, the
 *      nav/extension fallbacks), so the only observable change is calm.
 *   3. Crash guard: attaches one 'error' listener to the adapter's pg pool —
 *      an idle pooled client killed by a server-side FATAL (pooler restart,
 *      failover) otherwise emits an unhandled 'error' event that takes the
 *      whole serverless invocation down (the "exit status 128" 503s).
 *
 * On a healthy instance the overhead is one status lookup. State lives on
 * `globalThis` (same rationale as bootstrap-status.ts): `next dev` duplicates
 * modules across bundles.
 */
import type { Payload } from "payload";

import type { BootstrapStatus } from "../db/bootstrap-status";
import { ensureDbProvisioned } from "../db/bootstrap-runner";
import { getBootstrapStatus } from "../db/bootstrap-status";

/** Min gap between Payload init attempts after a failure. */
export const CMS_FAILURE_COOLDOWN_MS = 30_000;

/**
 * Thrown (fast, no connection attempt) while the guard is cooling down or the
 * database is known-unprovisioned. Callers' existing catch-and-degrade paths
 * handle it like any other Payload init failure.
 */
export class CmsUnavailableError extends Error {
  constructor(detail?: string) {
    super(`CMS unavailable${detail ? `: ${detail}` : ""} (see /api/health/db)`);
    this.name = "CmsUnavailableError";
  }
}

interface GateState {
  failedAt?: number;
  lastFailure?: string;
  poolsWithErrorListener?: WeakSet<object>;
}

const GLOBAL_KEY = "__dreamStarterKitCmsClientGate";

interface GlobalWithGate {
  [GLOBAL_KEY]?: GateState;
}

function gateState(): GateState {
  const g = globalThis as GlobalWithGate;
  return (g[GLOBAL_KEY] ??= {});
}

/** Test seam: forget failures/cooldowns and attached-pool bookkeeping. */
export function resetPayloadClientGate(): void {
  delete (globalThis as GlobalWithGate)[GLOBAL_KEY];
}

export interface PayloadClientDeps {
  /** Payload loader — defaults to `getPayload({ config })` (lazy imports). */
  loadPayload?: () => Promise<Payload>;
  /** Bootstrap re-run gate — defaults to lib/db/bootstrap-runner's. */
  ensureProvisioned?: () => Promise<BootstrapStatus>;
  bootstrapStatus?: () => BootstrapStatus;
  now?: () => number;
  logger?: Pick<Console, "warn">;
}

async function defaultLoadPayload(): Promise<Payload> {
  // Dynamic so callers that gate early (auth checks, kill switches) never pay
  // for Payload's module graph — the pattern the routes used individually.
  const [{ default: config }, { getPayload }] = await Promise.all([
    import("@payload-config"),
    import("payload"),
  ]);
  return getPayload({ config });
}

/**
 * An idle pooled connection can die OUTSIDE any query (Supavisor restart,
 * failover, credential-cache flush sends a FATAL): node-postgres emits 'error'
 * on the Pool, and with no listener that crashes the process — on Vercel the
 * whole invocation 503s ("Node.js process exited with exit status: 128").
 * Attach one warn-and-drop listener per pool; pg discards the broken client
 * and the next query checks out a fresh one.
 */
function attachPoolErrorListener(
  payload: Payload,
  log: Pick<Console, "warn">,
): void {
  const pool = (payload.db as unknown as { pool?: unknown }).pool;
  if (!pool || typeof pool !== "object") return;
  const on = (pool as { on?: unknown }).on;
  if (typeof on !== "function") return;
  const seen = (gateState().poolsWithErrorListener ??= new WeakSet());
  if (seen.has(pool)) return;
  seen.add(pool);
  (on as (event: string, listener: (error: unknown) => void) => unknown).call(
    pool,
    "error",
    (error) => {
      log.warn(
        "[cms] Postgres pool background error (idle client dropped; the pool replaces it)",
        error instanceof Error ? error.message : error,
      );
    },
  );
}

/** First line of an error message — enough context, never a multi-line dump. */
function failureSummary(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0] ?? message;
}

/**
 * `getPayload({ config })` behind the guard described in the module docs.
 * Throws {@link CmsUnavailableError} (fast) while cooling down or while the
 * database is unprovisioned and the heal attempt didn't fix it; otherwise
 * rethrows whatever Payload's init threw.
 */
export async function getPayloadClient(
  deps: PayloadClientDeps = {},
): Promise<Payload> {
  const state = gateState();
  const now = deps.now ?? Date.now;

  // `next build` prerenders never run the boot bootstrap (instrumentation
  // returns early), and a transient failure must not fail-fast the REST of the
  // worker's pages into baked-in default branding — keep the guard inert there
  // (every page attempts individually, exactly the pre-guard behavior).
  // NEXT_PHASE is set by Next itself, so it lives outside the zod env schema.
  // eslint-disable-next-line no-restricted-properties, turbo/no-undeclared-env-vars
  const buildPhase = process.env.NEXT_PHASE === "phase-production-build";

  if (
    !buildPhase &&
    state.failedAt !== undefined &&
    now() - state.failedAt < CMS_FAILURE_COOLDOWN_MS
  ) {
    throw new CmsUnavailableError(state.lastFailure);
  }

  // "error": the boot bootstrap failed — re-provision before touching the
  // pool (see module docs). "not-run": Vercel serves requests while register()
  // is still running, so a cold instance's bootstrap may be mid-flight —
  // ensureDbProvisioned JOINS an in-flight run (and is a no-op otherwise), so
  // the first requests wait for provisioning instead of racing it with
  // connection attempts as a role that may not exist yet.
  const bootStatus = (deps.bootstrapStatus ?? getBootstrapStatus)().status;
  if (bootStatus === "error" || bootStatus === "not-run") {
    const healed = await (deps.ensureProvisioned ?? ensureDbProvisioned)();
    if (healed.status === "error") {
      state.failedAt = now();
      state.lastFailure =
        healed.error?.message ?? "database not provisioned yet";
      throw new CmsUnavailableError(state.lastFailure);
    }
  }

  try {
    const payload = await (deps.loadPayload ?? defaultLoadPayload)();
    state.failedAt = undefined;
    state.lastFailure = undefined;
    attachPoolErrorListener(payload, deps.logger ?? console);
    return payload;
  } catch (error) {
    if (!buildPhase) {
      state.failedAt = now();
      state.lastFailure = failureSummary(error);
    }
    throw error;
  }
}
