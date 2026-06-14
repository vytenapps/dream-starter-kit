import type { SupabaseClient } from "@supabase/supabase-js";
import type { Payload } from "payload";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@acme/api/types";

import { runDispatch } from "./run-dispatch";

/**
 * Exercises the dispatch worker against fakes — no DB, no real Expo. Asserts
 * audience resolution (CMS user id → supabaseUserId), Expo fan-out, in-app
 * inserts, and the status/sentCount write-back.
 */

type Row = Record<string, unknown>;

function makeAdmin(tableData: Record<string, Row[]>) {
  const inserts: { table: string; rows: Row[] }[] = [];
  const api = {
    from(table: string) {
      const result = { data: tableData[table] ?? [] };
      return {
        select() {
          return {
            in: () => Promise.resolve(result),
            then: (resolve: (v: typeof result) => void) => resolve(result),
          };
        },
        insert(rows: Row[]) {
          inserts.push({ table, rows });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return { admin: api as unknown as SupabaseClient<Database>, inserts };
}

interface FindArgs {
  collection: string;
}
interface UpdateArgs {
  collection: string;
  id: string | number;
  data: Record<string, unknown>;
}

function makePayload(notifications: Row[], users: Row[]) {
  const updates: UpdateArgs[] = [];
  const payload = {
    find: vi.fn((args: FindArgs) => {
      if (args.collection === "notifications")
        return Promise.resolve({ docs: notifications });
      if (args.collection === "users") return Promise.resolve({ docs: users });
      return Promise.resolve({ docs: [] });
    }),
    update: vi.fn((args: UpdateArgs) => {
      updates.push(args);
      return Promise.resolve({});
    }),
    logger: { error: vi.fn() },
  };
  return { payload: payload as unknown as Payload, updates, raw: payload };
}

describe("runDispatch", () => {
  it("sends to targeted users (cms id → supabaseUserId) and marks sent", async () => {
    const { payload, updates, raw } = makePayload(
      [
        {
          id: 1,
          title: "Hi",
          body: "There",
          channel: ["push", "in_app"],
          audience: "users",
          targetUsers: [10],
        },
      ],
      [{ id: 10, supabaseUserId: "uuid-A" }],
    );
    const { admin, inserts } = makeAdmin({
      ext_notifications_push_tokens: [{ token: "ExpoTok1" }],
    });
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response("{}", { status: 200 })),
    );

    const result = await runDispatch({
      payload,
      admin,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ processed: 1, sent: 1, failed: 0 });
    // Claimed (sending) then completed (sent).
    expect(updates[0]?.data.status).toBe("sending");
    const final = updates[updates.length - 1];
    expect(final?.data.status).toBe("sent");
    expect(final?.data.sentCount).toBe(2); // 1 push token + 1 in-app row
    // Expo called with the targeted token.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // In-app row inserted for the resolved Supabase user id.
    const inApp = inserts.find((i) => i.table === "ext_notifications");
    expect(inApp?.rows[0]?.user_id).toBe("uuid-A");
    expect(raw.find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "users" }),
    );
  });

  it("marks a notification failed when delivery throws", async () => {
    const { payload, updates } = makePayload(
      [{ id: 2, title: "X", channel: ["push"], audience: "all" }],
      [],
    );
    const { admin } = makeAdmin({
      ext_notifications_push_tokens: [{ token: "T" }],
    });
    const fetchImpl = vi.fn(() => Promise.reject(new Error("expo down")));

    const result = await runDispatch({
      payload,
      admin,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ processed: 1, sent: 0, failed: 1 });
    expect(updates[updates.length - 1]?.data.status).toBe("failed");
  });

  it("does nothing when there are no due notifications", async () => {
    const { payload } = makePayload([], []);
    const { admin } = makeAdmin({});
    const result = await runDispatch({
      payload,
      admin,
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    expect(result).toEqual({ processed: 0, sent: 0, failed: 0 });
  });
});
