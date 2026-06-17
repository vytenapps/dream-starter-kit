import { describe, expect, it } from "vitest";

import {
  collectFieldMeta,
  deepEqual,
  detectDroppedFields,
  isEmptyValue,
} from "./verify";

/**
 * Unit coverage for the write-verifier that stops update_content/create_content
 * from reporting a false success when Payload silently drops a field. The three
 * real-world drop modes (modelled on the `ideas` collection) are:
 *   - planMd        — `access.update` denies → stored as null
 *   - planMarkdown  — derived/read-only → stored value ignores the input
 *   - planSections  — blocks missing `blockType` → stripped to []
 */

// A trimmed `ideas`-shaped field list (rows + collapsible + read-only fields).
const ideasFields = [
  { name: "name", type: "text" },
  { name: "hue", type: "number" },
  { name: "importMarkdown", type: "ui" },
  { type: "row", fields: [{ name: "score", type: "number" }] },
  { name: "planSections", type: "blocks" },
  {
    name: "planMarkdown",
    type: "json",
    admin: { readOnly: true },
  },
  {
    name: "planMd",
    type: "json",
    admin: { readOnly: true },
    access: { update: () => false },
  },
  {
    type: "collapsible",
    fields: [{ name: "imageHeroUrl", type: "text" }],
  },
];

describe("isEmptyValue", () => {
  it("treats null/undefined/blank/[]/{} as empty", () => {
    for (const v of [null, undefined, "", "   ", [], {}])
      expect(isEmptyValue(v)).toBe(true);
  });
  it("treats 0, false, and populated values as non-empty", () => {
    for (const v of [0, false, "x", [1], { a: 1 }])
      expect(isEmptyValue(v)).toBe(false);
  });
});

describe("deepEqual", () => {
  it("is order-insensitive for objects", () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual([1, 2], [1, 2])).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });
});

describe("collectFieldMeta", () => {
  const meta = collectFieldMeta(ideasFields);
  it("flattens through row + collapsible containers", () => {
    expect(meta.get("score")?.known).toBe(true);
    expect(meta.get("imageHeroUrl")?.known).toBe(true);
  });
  it("marks ui fields as non-data and read-only fields as such", () => {
    expect(meta.get("importMarkdown")?.ui).toBe(true);
    expect(meta.get("planMarkdown")?.readOnly).toBe(true);
    expect(meta.get("planMd")?.readOnly).toBe(true);
    expect(meta.get("name")?.readOnly).toBe(false);
  });
});

describe("detectDroppedFields", () => {
  const fields = collectFieldMeta(ideasFields);

  it("flags planMd (denied) — non-empty in, null stored", () => {
    const dropped = detectDroppedFields({
      requested: { planMd: { overview: "x" } },
      persisted: { planMd: null },
      fields,
    });
    expect(dropped.map((d) => d.field)).toEqual(["planMd"]);
  });

  it("flags planSections stripped to [] (blocks missing blockType)", () => {
    const dropped = detectDroppedFields({
      requested: { planSections: [{ section: "overview" }] },
      persisted: { planSections: [] },
      fields,
    });
    expect(dropped[0]?.field).toBe("planSections");
    expect(dropped[0]?.reason).toContain("blockType");
  });

  it("flags planMarkdown (read-only) — stored value ignores the input", () => {
    const dropped = detectDroppedFields({
      requested: { planMarkdown: { overview: "SENTINEL" } },
      persisted: { planMarkdown: { overview: "derived-from-sections" } },
      fields,
    });
    expect(dropped.map((d) => d.field)).toEqual(["planMarkdown"]);
  });

  it("does NOT flag a planSections write that actually landed", () => {
    // A successful blocks write: Payload echoes injected id/blockName + the
    // value is non-empty. The verifier must not deep-compare non-read-only
    // rich content, so this is reported as applied.
    const dropped = detectDroppedFields({
      requested: {
        planSections: [{ section: "overview", blockType: "planSection" }],
      },
      persisted: {
        planSections: [
          { id: "abc", blockName: null, section: "overview", body: {} },
        ],
      },
      fields,
    });
    expect(dropped).toEqual([]);
  });

  it("does NOT flag applied scalars or honoured field-clears", () => {
    const dropped = detectDroppedFields({
      requested: { hue: 7, name: "" },
      persisted: { hue: 7, name: "" },
      fields,
    });
    expect(dropped).toEqual([]);
  });

  it("flags unknown keys and ui-only fields, ignores meta keys", () => {
    const dropped = detectDroppedFields({
      requested: {
        bogus: "x",
        importMarkdown: "y",
        _status: "published",
        id: 5,
      },
      persisted: {},
      fields,
    });
    expect(dropped.map((d) => d.field).sort()).toEqual([
      "bogus",
      "importMarkdown",
    ]);
  });
});
