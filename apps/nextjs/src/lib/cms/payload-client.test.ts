import type { Payload } from "payload";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BootstrapStatus } from "../db/bootstrap-status";
import {
  CMS_FAILURE_COOLDOWN_MS,
  CmsUnavailableError,
  getPayloadClient,
  resetPayloadClientGate,
} from "./payload-client";

const okStatus: BootstrapStatus = {
  status: "ok",
  appliedVersions: [],
  cmsRoleCreated: false,
  cmsWarmed: true,
};

const errorStatus: BootstrapStatus = {
  ...okStatus,
  status: "error",
  cmsWarmed: false,
  error: { message: "timeout expired" },
};

/** Minimal Payload stand-in whose db.pool records 'error' listeners. */
function makeFakePayload() {
  const errorListeners: ((error: unknown) => void)[] = [];
  const pool = {
    on(event: string, listener: (error: unknown) => void) {
      if (event === "error") errorListeners.push(listener);
      return pool;
    },
  };
  const payload = { db: { pool } } as unknown as Payload;
  return { payload, pool, errorListeners };
}

afterEach(() => {
  resetPayloadClientGate();
});

describe("getPayloadClient", () => {
  it("returns Payload and attaches ONE pool error listener across calls", async () => {
    const fake = makeFakePayload();
    const loadPayload = vi.fn(() => Promise.resolve(fake.payload));
    const deps = { loadPayload, bootstrapStatus: () => okStatus };

    await expect(getPayloadClient(deps)).resolves.toBe(fake.payload);
    await expect(getPayloadClient(deps)).resolves.toBe(fake.payload);
    expect(fake.errorListeners).toHaveLength(1);

    // The listener only logs — a background FATAL must not throw/crash.
    const logger = { warn: vi.fn() };
    await getPayloadClient({ ...deps, logger });
    expect(() =>
      fake.errorListeners[0]?.(new Error("(EAUTHQUERY) user not found")),
    ).not.toThrow();
  });

  it("fails fast during the cooldown after an init failure, then retries", async () => {
    let clock = 5_000_000;
    const now = () => clock;
    const boom = new Error("cannot connect to Postgres");
    const loadPayload = vi
      .fn<() => Promise<Payload>>()
      .mockRejectedValueOnce(boom)
      .mockResolvedValue(makeFakePayload().payload);
    const deps = { loadPayload, bootstrapStatus: () => okStatus, now };

    // Original failure surfaces to the caller.
    await expect(getPayloadClient(deps)).rejects.toBe(boom);
    expect(loadPayload).toHaveBeenCalledTimes(1);

    // Within the cooldown: no second connection attempt.
    clock += CMS_FAILURE_COOLDOWN_MS - 1;
    await expect(getPayloadClient(deps)).rejects.toBeInstanceOf(
      CmsUnavailableError,
    );
    expect(loadPayload).toHaveBeenCalledTimes(1);

    // Past the cooldown: attempts again and recovers.
    clock += 2;
    await expect(getPayloadClient(deps)).resolves.toBeDefined();
    expect(loadPayload).toHaveBeenCalledTimes(2);

    // Success closed the breaker — next call goes straight through.
    await getPayloadClient(deps);
    expect(loadPayload).toHaveBeenCalledTimes(3);
  });

  it("re-provisions FIRST when the boot bootstrap failed, never touching the pool if still broken", async () => {
    const loadPayload = vi.fn(() => Promise.resolve(makeFakePayload().payload));
    const ensureProvisioned = vi.fn(() => Promise.resolve(errorStatus));

    await expect(
      getPayloadClient({
        loadPayload,
        ensureProvisioned,
        bootstrapStatus: () => errorStatus,
      }),
    ).rejects.toBeInstanceOf(CmsUnavailableError);

    expect(ensureProvisioned).toHaveBeenCalledTimes(1);
    // The whole point: an unprovisioned database must not see payload_cms
    // connection attempts (Supavisor's failed credential lookups trip its
    // circuit breaker and block the bootstrap's own connections).
    expect(loadPayload).not.toHaveBeenCalled();
  });

  it("joins an in-flight boot bootstrap when the status is still not-run", async () => {
    // Vercel serves requests while register() is mid-bootstrap; the guard must
    // wait for that run (via ensureProvisioned) rather than race it.
    const fake = makeFakePayload();
    const loadPayload = vi.fn(() => Promise.resolve(fake.payload));
    const ensureProvisioned = vi.fn(() => Promise.resolve(okStatus));

    await expect(
      getPayloadClient({
        loadPayload,
        ensureProvisioned,
        bootstrapStatus: () => ({ ...okStatus, status: "not-run" }),
      }),
    ).resolves.toBe(fake.payload);

    expect(ensureProvisioned).toHaveBeenCalledTimes(1);
    expect(loadPayload).toHaveBeenCalledTimes(1);
  });

  it("still attempts Payload when not-run persists (nothing in flight — dev/tests)", async () => {
    const fake = makeFakePayload();
    const loadPayload = vi.fn(() => Promise.resolve(fake.payload));
    const notRun = { ...okStatus, status: "not-run" as const };
    const ensureProvisioned = vi.fn(() => Promise.resolve(notRun));

    await expect(
      getPayloadClient({
        loadPayload,
        ensureProvisioned,
        bootstrapStatus: () => notRun,
      }),
    ).resolves.toBe(fake.payload);
    expect(loadPayload).toHaveBeenCalledTimes(1);
  });

  it("proceeds to Payload once the heal reports the database provisioned", async () => {
    const fake = makeFakePayload();
    const loadPayload = vi.fn(() => Promise.resolve(fake.payload));
    const ensureProvisioned = vi.fn(() => Promise.resolve(okStatus));

    await expect(
      getPayloadClient({
        loadPayload,
        ensureProvisioned,
        bootstrapStatus: () => errorStatus,
      }),
    ).resolves.toBe(fake.payload);

    expect(ensureProvisioned).toHaveBeenCalledTimes(1);
    expect(loadPayload).toHaveBeenCalledTimes(1);
  });

  it("cools down after a failed heal instead of re-running it per call", async () => {
    let clock = 9_000_000;
    const now = () => clock;
    const loadPayload = vi.fn(() => Promise.resolve(makeFakePayload().payload));
    const ensureProvisioned = vi.fn(() => Promise.resolve(errorStatus));
    const deps = {
      loadPayload,
      ensureProvisioned,
      bootstrapStatus: () => errorStatus,
      now,
    };

    await expect(getPayloadClient(deps)).rejects.toBeInstanceOf(
      CmsUnavailableError,
    );
    clock += CMS_FAILURE_COOLDOWN_MS - 1;
    await expect(getPayloadClient(deps)).rejects.toBeInstanceOf(
      CmsUnavailableError,
    );
    // Second call failed fast — the heal wasn't consulted again.
    expect(ensureProvisioned).toHaveBeenCalledTimes(1);
    expect(loadPayload).not.toHaveBeenCalled();
  });
});
