/* eslint-disable no-restricted-properties -- the module reads raw process.env
   (it's loaded by the Payload CLI without ~/env); tests set those vars directly. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// media-url.ts captures the Supabase URL + bucket at MODULE LOAD, so reset the
// module registry and re-import after setting env for each scenario.
const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://proj.supabase.co",
  S3_BUCKET: "cms-media",
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
};

async function load() {
  vi.resetModules();
  return import("./media-url");
}

describe("toPublicMediaUrl", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const [k, v] of Object.entries(ENV)) {
      saved[k] = process.env[k];
      process.env[k] = v;
    }
  });
  afterEach(() => {
    for (const k of Object.keys(ENV)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  const BASE = "https://proj.supabase.co/storage/v1/object/public/cms-media";

  it("rewrites a relative media URL (no prefix)", async () => {
    const { toPublicMediaUrl } = await load();
    expect(toPublicMediaUrl("/cms-api/media/file/hero.webp")).toBe(
      `${BASE}/hero.webp`,
    );
  });

  it("prepends the collection prefix for photos/audio", async () => {
    const { toPublicMediaUrl } = await load();
    expect(toPublicMediaUrl("/cms-api/photos/file/p.webp")).toBe(
      `${BASE}/photos/p.webp`,
    );
    expect(toPublicMediaUrl("/cms-api/audio/file/ep.mp3")).toBe(
      `${BASE}/audio/ep.mp3`,
    );
  });

  it("rewrites an absolute URL on this app's own host", async () => {
    const { toPublicMediaUrl } = await load();
    expect(
      toPublicMediaUrl("https://app.example.com/cms-api/photos/file/p.webp"),
    ).toBe(`${BASE}/photos/p.webp`);
  });

  it("leaves a foreign-host cms-api-looking URL untouched", async () => {
    const { toPublicMediaUrl } = await load();
    const foreign = "https://evil.example/cms-api/media/file/x.webp";
    expect(toPublicMediaUrl(foreign)).toBe(foreign);
  });

  it("passes through unknown collections and non-file URLs", async () => {
    const { toPublicMediaUrl } = await load();
    expect(toPublicMediaUrl("/cms-api/documents/file/d.pdf")).toBe(
      "/cms-api/documents/file/d.pdf",
    );
    expect(toPublicMediaUrl("https://cdn.example/img.png")).toBe(
      "https://cdn.example/img.png",
    );
  });

  it("drops a querystring on rewrite and handles null", async () => {
    const { toPublicMediaUrl } = await load();
    expect(toPublicMediaUrl("/cms-api/media/file/hero.webp?v=2")).toBe(
      `${BASE}/hero.webp`,
    );
    expect(toPublicMediaUrl(null)).toBeUndefined();
    expect(toPublicMediaUrl(undefined)).toBeUndefined();
  });
});

describe("generateMediaFileURL fallback (no Supabase URL)", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("emits the correct collection segment with the bare filename", async () => {
    const { generateMediaFileURL } = await load();
    expect(generateMediaFileURL({ filename: "x.webp" })).toBe(
      "/cms-api/media/file/x.webp",
    );
    expect(generateMediaFileURL({ filename: "x.webp", prefix: "photos" })).toBe(
      "/cms-api/photos/file/x.webp",
    );
  });
});
