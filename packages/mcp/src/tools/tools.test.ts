import type { Payload, TypedUser } from "payload";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { McpToolContext } from "../payload-context";
import { buildMcpServer } from "../server";

/**
 * Drives the real MCP tool layer through the SDK's in-memory client against a
 * FAKE Payload — validates tool registration, the SDK wiring, and that calls
 * pass `overrideAccess: false` + `user` to Payload (access enforced).
 */

/** Defensive readers — callTool's result type is broad, so narrow from unknown. */
function textOf(res: unknown): string {
  const content = (res as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  const first: unknown = content[0];
  if (first && typeof first === "object" && "text" in first) {
    const t = (first as { text?: unknown }).text;
    return typeof t === "string" ? t : "";
  }
  return "";
}

function isError(res: unknown): boolean {
  return Boolean((res as { isError?: unknown }).isError);
}

function makeFakePayload() {
  return {
    // Minimal collection config so write-verification can flatten fields.
    collections: {
      posts: {
        config: {
          fields: [
            { name: "title", type: "text" },
            { name: "slug", type: "text" },
            { name: "planMd", type: "json", admin: { readOnly: true } },
          ],
        },
      },
    } as Record<string, unknown>,
    find: vi.fn(() =>
      Promise.resolve({
        docs: [
          {
            id: "1",
            title: "Hello world",
            slug: "hello",
            _status: "published",
          },
        ],
        totalDocs: 1,
        page: 1,
        totalPages: 1,
      }),
    ),
    findByID: vi.fn(
      (): Promise<Record<string, unknown>> =>
        Promise.resolve({ id: "1", title: "Hello world", slug: "hello" }),
    ),
    create: vi.fn((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "new", ...args.data }),
    ),
    update: vi.fn((args: { id: string; data: Record<string, unknown> }) =>
      Promise.resolve({ id: args.id, ...args.data }),
    ),
    delete: vi.fn((args: { id: string }) => Promise.resolve({ id: args.id })),
  };
}

let fake: ReturnType<typeof makeFakePayload>;

async function connectClient(): Promise<Client> {
  const ctx: McpToolContext = {
    payload: fake as unknown as Payload,
    user: {
      id: "u1",
      collection: "users",
      roles: ["editor"],
    } as unknown as TypedUser,
    origin: "https://app.test",
  };
  const server = buildMcpServer(ctx);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(clientTransport);
  return client;
}

beforeEach(() => {
  fake = makeFakePayload();
});

describe("mcp tool layer", () => {
  it("exposes the expected tools", async () => {
    const client = await connectClient();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "list_collections",
        "search_content",
        "read_content",
        "create_content",
        "update_content",
        "delete_content",
        "search",
        "fetch",
        "notify_schedule",
        "notify_list",
      ]),
    );
  });

  it("search_content runs the query as the user (overrideAccess:false)", async () => {
    const client = await connectClient();
    const res: unknown = await client.callTool({
      name: "search_content",
      arguments: { collection: "posts", query: "hello" },
    });
    expect(isError(res)).toBe(false);
    // expect.objectContaining returns `any`; hold it as unknown to stay lint-clean.
    const userMatch: unknown = expect.objectContaining({ id: "u1" });
    expect(fake.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "posts",
        overrideAccess: false,
        user: userMatch,
      }),
    );
    expect(textOf(res)).toContain("Hello world");
  });

  it("create_content rejects an unknown collection at the schema layer", async () => {
    const client = await connectClient();
    const res: unknown = await client.callTool({
      name: "create_content",
      arguments: { collection: "not_a_collection", data: {} },
    });
    // zod enum rejects the bad slug → tool error, and Payload is never called.
    expect(isError(res)).toBe(true);
    expect(fake.create).not.toHaveBeenCalled();
  });

  it("notify_schedule creates a scheduled notification", async () => {
    const client = await connectClient();
    const res: unknown = await client.callTool({
      name: "notify_schedule",
      arguments: { title: "Launch!", body: "We're live", channel: ["push"] },
    });
    expect(isError(res)).toBe(false);
    const dataMatch: unknown = expect.objectContaining({
      status: "scheduled",
      title: "Launch!",
    });
    expect(fake.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "notifications",
        overrideAccess: false,
        data: dataMatch,
      }),
    );
  });

  it("update_content errors (no false success) when a field is silently dropped", async () => {
    const client = await connectClient();
    // Payload's write echo claims planMd was saved, but the authoritative
    // re-read (findByID) shows it stored as null — the field was stripped.
    fake.findByID.mockResolvedValueOnce({
      id: "1",
      title: "Hello world",
      slug: "hello",
      planMd: null,
    });
    const res: unknown = await client.callTool({
      name: "update_content",
      arguments: {
        collection: "posts",
        id: "1",
        data: { planMd: { overview: "should not persist" } },
      },
    });
    expect(isError(res)).toBe(true);
    const text = textOf(res);
    expect(text).toContain("planMd");
    expect(text).not.toContain('"updated": true');
    // The doc was still written (other fields), but it's flagged, not "updated:true".
    expect(fake.update).toHaveBeenCalled();
  });

  it("update_content reports success when all supplied fields persist", async () => {
    const client = await connectClient();
    fake.findByID.mockResolvedValueOnce({
      id: "1",
      title: "Renamed",
      slug: "hello",
    });
    const res: unknown = await client.callTool({
      name: "update_content",
      arguments: { collection: "posts", id: "1", data: { title: "Renamed" } },
    });
    expect(isError(res)).toBe(false);
    expect(textOf(res)).toContain('"updated": true');
  });

  it("fetch parses a collection:id and returns a document", async () => {
    const client = await connectClient();
    const res: unknown = await client.callTool({
      name: "fetch",
      arguments: { id: "posts:1" },
    });
    expect(isError(res)).toBe(false);
    const text = textOf(res);
    expect(text).toContain("posts:1");
    expect(text).toContain("https://app.test/posts/hello");
  });
});
