import type { Payload } from "payload";
import { describe, expect, it, vi } from "vitest";

import type { SchemaCheckClient } from "./ensure-schema";
import {
  healCmsSchema,
  isMissingCmsTablesError,
  withCmsSchemaHeal,
} from "./ensure-schema";

const DB_URL = "postgresql://payload_cms:pw@127.0.0.1:54322/postgres";

// The heal never touches the payload instance beyond `deps.migrate(payload)`.
const fakePayload = {} as Payload;

function undefinedTableError() {
  const cause = Object.assign(
    new Error('relation "cms.users" does not exist'),
    { code: "42P01" },
  );
  return new Error("Failed query: select count(*) …", { cause });
}

/**
 * Fake client serving BOTH connections the heal opens: the init-lock session
 * and the schema-check session. `to_regclass` checks answer from `state`.
 */
function makeClient(state: { users: boolean; ledger: boolean }) {
  const calls: string[] = [];
  const client: SchemaCheckClient = {
    query(sql: string) {
      calls.push(sql);
      if (sql.includes("to_regclass")) {
        return Promise.resolve({
          rows: [{ users_exists: state.users, ledger_exists: state.ledger }],
        });
      }
      return Promise.resolve({ rows: [] });
    },
    end: () => Promise.resolve(),
  };
  return { client, calls };
}

const spyLogger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });

describe("isMissingCmsTablesError", () => {
  it("matches 42P01 at the top of the chain", () => {
    expect(
      isMissingCmsTablesError(
        Object.assign(new Error("nope"), { code: "42P01" }),
      ),
    ).toBe(true);
  });

  it("matches 42P01 nested in the cause chain (Drizzle wraps pg errors)", () => {
    expect(isMissingCmsTablesError(undefinedTableError())).toBe(true);
  });

  it("rejects other codes and non-errors", () => {
    expect(
      isMissingCmsTablesError(
        Object.assign(new Error("denied"), { code: "42501" }),
      ),
    ).toBe(false);
    expect(isMissingCmsTablesError(new Error("plain"))).toBe(false);
    expect(isMissingCmsTablesError("42P01")).toBe(false);
    expect(isMissingCmsTablesError(undefined)).toBe(false);
  });
});

describe("healCmsSchema", () => {
  it("applies migrations when the cms schema is empty", async () => {
    const { client } = makeClient({ users: false, ledger: false });
    const migrate = vi.fn(() => Promise.resolve());
    const logger = spyLogger();
    await expect(
      healCmsSchema(fakePayload, {
        databaseUrl: DB_URL,
        createClient: () => Promise.resolve(client),
        migrate,
        logger,
      }),
    ).resolves.toBe(true);
    expect(migrate).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("cms schema healed"),
    );
  });

  it("no-ops (success) when another instance already healed", async () => {
    const { client } = makeClient({ users: true, ledger: true });
    const migrate = vi.fn(() => Promise.resolve());
    await expect(
      healCmsSchema(fakePayload, {
        databaseUrl: DB_URL,
        createClient: () => Promise.resolve(client),
        migrate,
        logger: spyLogger(),
      }),
    ).resolves.toBe(true);
    expect(migrate).not.toHaveBeenCalled();
  });

  it("refuses to migrate a partially provisioned schema (ledger without users)", async () => {
    // migrate() would prompt interactively on a dev-push ledger record — and
    // process.exit the server on a closed stdin — so this state must abort.
    const { client } = makeClient({ users: false, ledger: true });
    const migrate = vi.fn(() => Promise.resolve());
    const logger = spyLogger();
    await expect(
      healCmsSchema(fakePayload, {
        databaseUrl: DB_URL,
        createClient: () => Promise.resolve(client),
        migrate,
        logger,
      }),
    ).resolves.toBe(false);
    expect(migrate).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("pnpm cms:migrate"),
    );
  });

  it("fails soft when the schema can't be inspected", async () => {
    const logger = spyLogger();
    await expect(
      healCmsSchema(fakePayload, {
        databaseUrl: DB_URL,
        createClient: () => Promise.reject(new Error("ECONNREFUSED")),
        migrate: vi.fn(() => Promise.resolve()),
        logger,
      }),
    ).resolves.toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("skipping self-heal"),
      expect.any(Error),
    );
  });

  it("does nothing when the CMS is not configured (no database url)", async () => {
    const createClient = vi.fn();
    await expect(
      healCmsSchema(fakePayload, {
        databaseUrl: "",
        createClient,
        logger: spyLogger(),
      }),
    ).resolves.toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("reports failure when applying migrations throws", async () => {
    const { client } = makeClient({ users: false, ledger: false });
    const logger = spyLogger();
    await expect(
      healCmsSchema(fakePayload, {
        databaseUrl: DB_URL,
        createClient: () => Promise.resolve(client),
        migrate: () => Promise.reject(new Error("migration boom")),
        logger,
      }),
    ).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("migrations failed"),
      expect.any(Error),
    );
  });
});

describe("withCmsSchemaHeal", () => {
  const healDeps = (state: { users: boolean; ledger: boolean }) => {
    const migrate = vi.fn(() => {
      state.users = true; // migrations create the tables
      return Promise.resolve();
    });
    return {
      deps: {
        databaseUrl: DB_URL,
        createClient: () => Promise.resolve(makeClient(state).client),
        migrate,
        logger: spyLogger(),
      },
      migrate,
    };
  };

  it("passes results through without healing on success", async () => {
    const { deps, migrate } = healDeps({ users: true, ledger: true });
    const fn = vi.fn(() => Promise.resolve("ok"));
    await expect(withCmsSchemaHeal(fakePayload, fn, deps)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledOnce();
    expect(migrate).not.toHaveBeenCalled();
  });

  it("rethrows non-42P01 errors untouched", async () => {
    const { deps, migrate } = healDeps({ users: true, ledger: true });
    await expect(
      withCmsSchemaHeal(
        fakePayload,
        () => Promise.reject(new Error("RLS denied")),
        deps,
      ),
    ).rejects.toThrow("RLS denied");
    expect(migrate).not.toHaveBeenCalled();
  });

  it("heals and retries once on a missing cms table", async () => {
    const state = { users: false, ledger: false };
    const { deps, migrate } = healDeps(state);
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(undefinedTableError())
      .mockResolvedValueOnce("recovered");
    await expect(withCmsSchemaHeal(fakePayload, fn, deps)).resolves.toBe(
      "recovered",
    );
    expect(migrate).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("rethrows the original error when the heal cannot fix the schema", async () => {
    // Partial schema: heal refuses, the 42P01 surfaces to the caller.
    const { deps, migrate } = healDeps({ users: false, ledger: true });
    const fn = vi.fn(() => Promise.reject(undefinedTableError()));
    await expect(withCmsSchemaHeal(fakePayload, fn, deps)).rejects.toThrow(
      "Failed query",
    );
    expect(migrate).not.toHaveBeenCalled();
    expect(fn).toHaveBeenCalledOnce();
  });
});
