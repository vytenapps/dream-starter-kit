import { describe, expect, it } from "vitest";

import { slidingWindow } from "./rate-limit";

describe("slidingWindow", () => {
  it("allows requests under the limit", () => {
    const r = slidingWindow([], 1000, 60_000, 3);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
    expect(r.hits).toEqual([1000]);
  });

  it("blocks when the limit is reached within the window", () => {
    const r = slidingWindow([100, 200, 300], 400, 60_000, 3);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.hits).toHaveLength(3); // unchanged
  });

  it("expires hits outside the window", () => {
    // two old hits (outside 1s window) + one recent → allowed
    const r = slidingWindow([0, 10, 9000], 9500, 1000, 2);
    expect(r.allowed).toBe(true);
    expect(r.hits).toEqual([9000, 9500]);
  });
});
