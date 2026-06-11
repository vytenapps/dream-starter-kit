import { describe, expect, it, vi } from "vitest";

import type { LockClient } from "./init-lock";
import { withCmsInitLock } from "./init-lock";

const DB_URL = "postgresql://payload_cms:pw@127.0.0.1:54322/postgres";

function makeLockClient(opts: { failOnLock?: boolean } = {}) {
  const calls: string[] = [];
  let ended = false;
  const client: LockClient = {
    query(sql: string) {
      calls.push(sql);
      if (opts.failOnLock && sql.includes("pg_advisory_lock(")) {
        return Promise.reject(new Error("lock failed"));
      }
      return Promise.resolve({ rows: [] });
    },
    end() {
      ended = true;
      return Promise.resolve();
    },
  };
  return { client, calls, isEnded: () => ended };
}

const spyLogger = () => ({ warn: vi.fn() });

describe("withCmsInitLock", () => {
  it("locks, runs the warm-up, then unlocks and closes the connection", async () => {
    const fake = makeLockClient();
    const order: string[] = [];
    const result = await withCmsInitLock(
      () => {
        order.push("fn");
        // The lock must already be held when the warm-up runs.
        expect(fake.calls.some((s) => s.includes("pg_advisory_lock("))).toBe(
          true,
        );
        return Promise.resolve("warmed");
      },
      {
        databaseUrl: DB_URL,
        createClient: () => Promise.resolve(fake.client),
        logger: spyLogger(),
      },
    );
    expect(result).toBe("warmed");
    expect(order).toEqual(["fn"]);
    expect(fake.calls.some((s) => s.includes("pg_advisory_unlock("))).toBe(
      true,
    );
    expect(fake.isEnded()).toBe(true);
  });

  it("unlocks even when the warm-up throws (and rethrows)", async () => {
    const fake = makeLockClient();
    await expect(
      withCmsInitLock(() => Promise.reject(new Error("init boom")), {
        databaseUrl: DB_URL,
        createClient: () => Promise.resolve(fake.client),
        logger: spyLogger(),
      }),
    ).rejects.toThrow("init boom");
    expect(fake.calls.some((s) => s.includes("pg_advisory_unlock("))).toBe(
      true,
    );
    expect(fake.isEnded()).toBe(true);
  });

  it("proceeds UNLOCKED when the lock connection fails (best-effort)", async () => {
    const logger = spyLogger();
    const result = await withCmsInitLock(() => Promise.resolve("ran"), {
      databaseUrl: DB_URL,
      createClient: () => Promise.reject(new Error("EMAXCONNSESSION")),
      logger,
    });
    expect(result).toBe("ran");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("proceeding unlocked"),
      expect.any(Error),
    );
  });

  it("proceeds unlocked (and cleans up) when taking the lock fails mid-session", async () => {
    const fake = makeLockClient({ failOnLock: true });
    const result = await withCmsInitLock(() => Promise.resolve("ran"), {
      databaseUrl: DB_URL,
      createClient: () => Promise.resolve(fake.client),
      logger: spyLogger(),
    });
    expect(result).toBe("ran");
    expect(fake.isEnded()).toBe(true);
  });

  it("skips locking entirely when no database url is resolvable", async () => {
    const createClient = vi.fn();
    const result = await withCmsInitLock(() => Promise.resolve("ran"), {
      // Empty string = "explicitly no url" (undefined would fall back to the
      // real env via resolveCmsCredentials).
      databaseUrl: "",
      createClient,
      logger: spyLogger(),
    });
    expect(result).toBe("ran");
    expect(createClient).not.toHaveBeenCalled();
  });
});
