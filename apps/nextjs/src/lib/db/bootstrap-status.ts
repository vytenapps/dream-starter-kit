/**
 * Last runtime-DB-bootstrap result, recorded for the public `/api/health/db`
 * endpoint. The bootstrap itself never throws (it logs and degrades to the
 * manual `supabase db push` flow), so without this surface a failed first
 * boot — e.g. a TLS error against hosted Supabase — is invisible outside the
 * server logs while the app runs against an empty database.
 *
 * Keyed on `globalThis`, NOT module scope: `next dev` can instantiate
 * separate copies of this module in the instrumentation bundle (the writer)
 * and the route bundle (the reader). On serverless the status reflects this
 * instance's boot — exactly what a founder debugging a fresh deploy needs.
 */
import type { BootstrapResult } from "./bootstrap";

export interface BootstrapStatus {
  status:
    | "ok"
    | "skipped:opt-out"
    | "skipped:build-phase"
    | "skipped:no-url"
    | "error"
    | "not-run";
  appliedVersions: string[];
  cmsRoleCreated: boolean;
  /** Whether the bootstrap ran the CMS migrate/warm-up under its lock at boot
   * (vs. deferring Payload init to the request path). On a fresh project this
   * MUST be true — the e2e health gate asserts it, guarding the first-deploy
   * /welcome 500 regression (request-path prodMigrations racing → process.exit). */
  cmsWarmed: boolean;
  error?: { code?: string; message: string };
}

const GLOBAL_KEY = "__dreamStarterKitDbBootstrapStatus";

interface GlobalWithStatus {
  [GLOBAL_KEY]?: BootstrapStatus;
}

/** Pure result → status mapping (unit-tested in bootstrap-status.test.ts). */
export function toBootstrapStatus(result: BootstrapResult): BootstrapStatus {
  const base = {
    appliedVersions: result.appliedVersions,
    cmsRoleCreated: result.cmsRoleCreated,
    cmsWarmed: result.cmsWarmed,
  };
  // A mid-run migration failure returns `skipped: false` WITH an error — that
  // is an error state, not a success with fewer migrations.
  if (result.error) {
    return { status: "error", ...base, error: result.error };
  }
  switch (result.skipped) {
    case "opt-out":
    case "build-phase":
    case "no-url":
      return { status: `skipped:${result.skipped}`, ...base };
    // "error" without an error summary can't happen (the catch-all always
    // attaches one) — map it to "error" anyway rather than lying with "ok".
    case "error":
      return { status: "error", ...base };
    default:
      // "up-to-date" or false (work done): the connection + inspection ran.
      return { status: "ok", ...base };
  }
}

export function recordBootstrapResult(result: BootstrapResult): void {
  (globalThis as GlobalWithStatus)[GLOBAL_KEY] = toBootstrapStatus(result);
}

export function getBootstrapStatus(): BootstrapStatus {
  return (
    (globalThis as GlobalWithStatus)[GLOBAL_KEY] ?? {
      status: "not-run",
      appliedVersions: [],
      cmsRoleCreated: false,
      cmsWarmed: false,
    }
  );
}
