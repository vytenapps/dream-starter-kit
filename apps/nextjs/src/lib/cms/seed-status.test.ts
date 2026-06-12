import type { Payload } from "payload";
import { describe, expect, it } from "vitest";

import { isCmsSeeded } from "./seed-status";

function fakePayload(totalDocs: number): Payload {
  return {
    find: () => Promise.resolve({ totalDocs }),
  } as unknown as Payload;
}

describe("isCmsSeeded", () => {
  it("is true once pages exist", async () => {
    await expect(isCmsSeeded(fakePayload(3))).resolves.toBe(true);
  });

  it("is false on a fresh CMS", async () => {
    await expect(isCmsSeeded(fakePayload(0))).resolves.toBe(false);
  });

  it("propagates non-42P01 query failures to the caller", async () => {
    const payload = {
      find: () => Promise.reject(new Error("connection refused")),
    } as unknown as Payload;
    await expect(isCmsSeeded(payload)).rejects.toThrow("connection refused");
  });
});
