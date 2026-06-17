import type { PayloadRequest } from "payload";
import { describe, expect, it } from "vitest";

import {
  formatBulkDeleteResponse,
  isBulkCollectionDelete,
} from "./resilient-delete";

const params = (search: string) => new URLSearchParams(search);

describe("isBulkCollectionDelete", () => {
  it("matches a single-segment collection delete carrying a where", () => {
    expect(
      isBulkCollectionDelete(
        ["idea-categories"],
        params("limit=0&where[and][0][id][in][0]=1"),
      ),
    ).toBe(true);
  });

  it("ignores a by-id delete (two segments)", () => {
    expect(isBulkCollectionDelete(["idea-categories", "42"], params(""))).toBe(
      false,
    );
  });

  it("ignores a bulk delete with no where (Payload's own 400 path)", () => {
    expect(isBulkCollectionDelete(["idea-categories"], params("limit=0"))).toBe(
      false,
    );
  });

  it("ignores missing / empty slugs", () => {
    expect(isBulkCollectionDelete(undefined, params("where[x]=1"))).toBe(false);
    expect(isBulkCollectionDelete([], params("where[x]=1"))).toBe(false);
  });
});

// A `t` that echoes the key + interpolated vars so assertions can read them.
const fakeT = ((key: string, vars?: Record<string, unknown>) =>
  `${key}|${JSON.stringify(vars)}`) as unknown as PayloadRequest["t"];

const labels = { singular: "Idea Category", plural: "Idea Categories" };

describe("formatBulkDeleteResponse", () => {
  it("returns 200 and a success message when nothing failed", async () => {
    const res = formatBulkDeleteResponse(
      { docs: [{ id: 1 }, { id: 2 }], errors: [] },
      { t: fakeT, language: "en", labels, headers: new Headers() },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { message: string; docs: unknown[] };
    expect(body.docs).toHaveLength(2);
    expect(body.message).toContain("general:deletedCountSuccessfully");
    expect(body.message).toContain("Idea Categories");
  });

  it("returns 400 with a partial-failure summary when some rows fail", async () => {
    const res = formatBulkDeleteResponse(
      {
        docs: [{ id: 2 }, { id: 3 }],
        errors: [{ id: 1, isPublic: false, message: "FK violation: ideas" }],
      },
      { t: fakeT, language: "en", labels, headers: new Headers() },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      message: string;
      docs: unknown[];
      errors: { message: string }[];
    };
    // The deletable rows were still removed...
    expect(body.docs).toHaveLength(2);
    // ...and only the blocked row is reported.
    expect(body.errors).toHaveLength(1);
    // count = 1 failed, total = 3 (2 deleted + 1 failed).
    expect(body.message).toContain("error:unableToDeleteCount");
    expect(body.message).toContain('"count":1');
    expect(body.message).toContain('"total":3');
  });

  it("masks non-public error messages to a generic string", async () => {
    const res = formatBulkDeleteResponse(
      {
        docs: [],
        errors: [{ id: 1, isPublic: false, message: "constraint cms_blocker" }],
      },
      { t: fakeT, language: "en", labels, headers: new Headers() },
    );
    const body = (await res.json()) as { errors: { message: string }[] };
    expect(body.errors[0]?.message).toBe("Something went wrong.");
  });

  it("preserves public error messages", async () => {
    const res = formatBulkDeleteResponse(
      {
        docs: [],
        errors: [{ id: 1, isPublic: true, message: "Document is locked." }],
      },
      { t: fakeT, language: "en", labels, headers: new Headers() },
    );
    const body = (await res.json()) as { errors: { message: string }[] };
    expect(body.errors[0]?.message).toBe("Document is locked.");
  });

  it("resolves localized label objects for the request language", async () => {
    const res = formatBulkDeleteResponse(
      { docs: [{ id: 1 }], errors: [] },
      {
        t: fakeT,
        language: "es",
        labels: {
          singular: { en: "Category", es: "Categoría" },
          plural: { en: "Categories", es: "Categorías" },
        },
        headers: new Headers(),
      },
    );
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain("Categoría");
  });
});
