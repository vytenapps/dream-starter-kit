import { describe, expect, it } from "vitest";

import type { BootstrapResult } from "./bootstrap";
import {
  getBootstrapStatus,
  recordBootstrapResult,
  toBootstrapStatus,
} from "./bootstrap-status";

const result = (over: Partial<BootstrapResult> = {}): BootstrapResult => ({
  skipped: false,
  appliedVersions: [],
  cmsRoleCreated: false,
  ...over,
});

// NOTE: the "not-run" test must run before anything records — vitest executes
// tests in this file top-to-bottom, and the file gets a fresh global scope.
describe("getBootstrapStatus before any run", () => {
  it("reports not-run", () => {
    expect(getBootstrapStatus()).toEqual({
      status: "not-run",
      appliedVersions: [],
      cmsRoleCreated: false,
    });
  });
});

describe("toBootstrapStatus", () => {
  it("maps provisioning work and up-to-date runs to ok", () => {
    expect(
      toBootstrapStatus(
        result({ appliedVersions: ["20260609000001"], cmsRoleCreated: true }),
      ),
    ).toEqual({
      status: "ok",
      appliedVersions: ["20260609000001"],
      cmsRoleCreated: true,
    });
    expect(toBootstrapStatus(result({ skipped: "up-to-date" })).status).toBe(
      "ok",
    );
  });

  // These exact strings are the contract the e2e health gate
  // (tooling/web-e2e/src/founder.setup.ts) asserts against — don't drift.
  it.each([
    ["opt-out", "skipped:opt-out"],
    ["build-phase", "skipped:build-phase"],
    ["no-url", "skipped:no-url"],
  ] as const)("maps the %s gate to %s", (skipped, status) => {
    expect(toBootstrapStatus(result({ skipped })).status).toBe(status);
  });

  it("maps the catch-all failure to error with the sanitized summary", () => {
    const status = toBootstrapStatus(
      result({
        skipped: "error",
        error: { code: "SELF_SIGNED_CERT_IN_CHAIN", message: "tls failed" },
      }),
    );
    expect(status.status).toBe("error");
    expect(status.error).toEqual({
      code: "SELF_SIGNED_CERT_IN_CHAIN",
      message: "tls failed",
    });
  });

  it("maps a mid-run migration failure (skipped:false + error) to error, not ok", () => {
    const status = toBootstrapStatus(
      result({
        skipped: false,
        appliedVersions: ["20260609000001"],
        error: { message: "migration 2 failed" },
      }),
    );
    expect(status.status).toBe("error");
    expect(status.appliedVersions).toEqual(["20260609000001"]);
  });

  it("never reports ok for an error-skip even without a summary", () => {
    expect(toBootstrapStatus(result({ skipped: "error" })).status).toBe(
      "error",
    );
  });
});

describe("recordBootstrapResult / getBootstrapStatus", () => {
  it("round-trips the latest result through globalThis", () => {
    recordBootstrapResult(result({ skipped: "no-url" }));
    expect(getBootstrapStatus().status).toBe("skipped:no-url");

    recordBootstrapResult(
      result({ appliedVersions: ["20260609000001"], cmsRoleCreated: true }),
    );
    expect(getBootstrapStatus()).toEqual({
      status: "ok",
      appliedVersions: ["20260609000001"],
      cmsRoleCreated: true,
    });
  });
});
