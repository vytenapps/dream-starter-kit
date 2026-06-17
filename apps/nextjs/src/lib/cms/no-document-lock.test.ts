import type { CollectionConfig, GlobalConfig } from "payload";
import { describe, expect, it } from "vitest";

import { noDocumentLock } from "./no-document-lock";

describe("noDocumentLock", () => {
  it("forces lockDocuments to false on a collection", () => {
    const collection = {
      slug: "ideas",
      fields: [{ name: "title", type: "text" }],
    } as unknown as CollectionConfig;

    expect(noDocumentLock(collection).lockDocuments).toBe(false);
  });

  it("forces lockDocuments to false on a global", () => {
    const global = {
      slug: "site-settings",
      fields: [],
    } as unknown as GlobalConfig;

    expect(noDocumentLock(global).lockDocuments).toBe(false);
  });

  it("overrides an explicitly-enabled lock duration", () => {
    const collection = {
      slug: "posts",
      fields: [],
      lockDocuments: { duration: 300 },
    } as unknown as CollectionConfig;

    expect(noDocumentLock(collection).lockDocuments).toBe(false);
  });

  it("preserves every other config property", () => {
    const collection = {
      slug: "events",
      admin: { useAsTitle: "title", group: "Content" },
      fields: [{ name: "title", type: "text" }],
      access: { read: () => true },
    } as unknown as CollectionConfig;

    const result = noDocumentLock(collection);
    expect(result.slug).toBe("events");
    expect(result.admin).toBe(collection.admin);
    expect(result.fields).toBe(collection.fields);
    expect(result.access).toBe(collection.access);
  });
});
