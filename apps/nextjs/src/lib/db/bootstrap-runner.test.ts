import { afterEach, describe, expect, it, vi } from "vitest";

import type { BootstrapResult } from "./bootstrap";
import {
  ensureDbProvisioned,
  PROVISION_RETRY_COOLDOWN_MS,
  resetBootstrapRunner,
  runFullBootstrap,
} from "./bootstrap-runner";
import { recordBootstrapResult, resetBootstrapStatus } from "./bootstrap-status";

const OK: BootstrapResult = {
  skipped: "up-to-date",
  appliedVersions: [],
  cmsRoleCreated: false,
  cmsWarmed: false,
};

const FAILED: BootstrapResult = {
  skipped: "error",
  appliedVersions: [],
  cmsRoleCreated: false,
  cmsWarmed: false,
  error: { message: "timeout expired" },
};

/** Fake bootstrap invocation that records its result like the real one does. */
const fakeBootstrap = (result: BootstrapResult) =>
  vi.fn(() => {
    recordBootstrapResult(result);
    return Promise.resolve(result);
  });

afterEach(() => {
  resetBootstrapRunner();
  resetBootstrapStatus();
});

describe("runFullBootstrap", () => {
  it("is single-flight: concurrent callers share one run", async () => {
    let resolveRun!: (r: BootstrapResult) => void;
    const bootstrap = vi.fn(
      () =>
        new Promise<BootstrapResult>((resolve) => {
          resolveRun = resolve;
        }),
    );
    const first = runFullBootstrap({ bootstrap });
    const second = runFullBootstrap({ bootstrap });
    resolveRun(OK);
    await expect(first).resolves.toBe(OK);
    await expect(second).resolves.toBe(OK);
    expect(bootstrap).toHaveBeenCalledTimes(1);
  });

  it("allows a fresh run once the previous one settled", async () => {
    const bootstrap = fakeBootstrap(OK);
    await runFullBootstrap({ bootstrap });
    await runFullBootstrap({ bootstrap });
    expect(bootstrap).toHaveBeenCalledTimes(2);
  });
});

describe("ensureDbProvisioned", () => {
  it.each(["ok", "skipped:no-url", "not-run"] as const)(
    "passes %s through without re-running the bootstrap",
    async (status) => {
      if (status === "ok") recordBootstrapResult(OK);
      if (status === "skipped:no-url") {
        recordBootstrapResult({ ...OK, skipped: "no-url" });
      }
      // "not-run": nothing recorded.
      const bootstrap = fakeBootstrap(OK);
      const result = await ensureDbProvisioned({ bootstrap });
      expect(result.status).toBe(status);
      expect(bootstrap).not.toHaveBeenCalled();
    },
  );

  it("re-runs a failed bootstrap and reports the healed status", async () => {
    recordBootstrapResult(FAILED);
    const bootstrap = fakeBootstrap(OK);
    const result = await ensureDbProvisioned({ bootstrap });
    expect(bootstrap).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("ok");
  });

  it("honors the cooldown between failed re-runs, then retries after it", async () => {
    recordBootstrapResult(FAILED);
    let clock = 1_000_000;
    const now = () => clock;
    const bootstrap = fakeBootstrap(FAILED);

    // First call attempts (and fails again).
    await ensureDbProvisioned({ bootstrap, now });
    expect(bootstrap).toHaveBeenCalledTimes(1);

    // Within the cooldown: no new attempt, still-failed status reported.
    clock += PROVISION_RETRY_COOLDOWN_MS - 1;
    const during = await ensureDbProvisioned({ bootstrap, now });
    expect(bootstrap).toHaveBeenCalledTimes(1);
    expect(during.status).toBe("error");

    // Past the cooldown: retries.
    clock += 2;
    await ensureDbProvisioned({ bootstrap, now });
    expect(bootstrap).toHaveBeenCalledTimes(2);
  });

  it("joins an in-flight run instead of starting another", async () => {
    recordBootstrapResult(FAILED);
    let resolveRun!: (r: BootstrapResult) => void;
    const bootstrap = vi.fn(
      () =>
        new Promise<BootstrapResult>((resolve) => {
          resolveRun = resolve;
        }),
    );
    const first = ensureDbProvisioned({ bootstrap });
    const second = ensureDbProvisioned({ bootstrap });
    recordBootstrapResult(OK); // what the real run would do before settling
    resolveRun(OK);
    await expect(first).resolves.toMatchObject({ status: "ok" });
    await expect(second).resolves.toMatchObject({ status: "ok" });
    expect(bootstrap).toHaveBeenCalledTimes(1);
  });
});
