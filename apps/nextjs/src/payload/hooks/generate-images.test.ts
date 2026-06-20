import type { CollectionBeforeChangeHook } from "payload";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GeneratedImage, ImageFormatSpec } from "../../lib/image-formats";

// Mock the heavy generation lib (loads `ai` + `sharp`); we only need
// generateOneImage to return a buffer (or reject) per format.
const generateOneImageMock =
  vi.fn<(args: { format: ImageFormatSpec }) => Promise<GeneratedImage>>();
vi.mock("../../lib/image-generation", () => ({
  generateOneImage: (args: { format: ImageFormatSpec }) =>
    generateOneImageMock(args),
}));

import {
  generateImagesHook,
  syncImageUrls,
  urlCacheField,
} from "./generate-images";

const FORMATS: ImageFormatSpec[] = [
  {
    key: "hero",
    field: "imageHero",
    aspectRatio: "16:9",
    width: 1600,
    height: 900,
    composition: "wide",
  },
  {
    key: "og",
    field: "imageOg",
    aspectRatio: "40:21",
    width: 1200,
    height: 630,
    composition: "social",
  },
];

// Inline impls so each mock's return type is inferred (not `any`); mirrors the
// fake-Payload pattern in packages/mcp/src/tools/tools.test.ts.
function fakePayload(over?: {
  findGlobal?: () => Promise<unknown>;
}) {
  let nextId = 100;
  return {
    logger: { warn: vi.fn<(m: string) => void>(), info: vi.fn<(m: string) => void>(), error: vi.fn<(m: string) => void>() },
    findGlobal: vi.fn<() => Promise<unknown>>(() =>
      Promise.resolve({ enabled: true, model: "m", systemPrompt: "sp" }),
    ),
    create: vi.fn<(args: { collection: string; data: { alt: string } }) => Promise<{ id: number }>>(
      () => Promise.resolve({ id: nextId++ }),
    ),
    findByID: vi.fn<() => Promise<{ url: string }>>(() =>
      Promise.resolve({ url: "/cms-api/media/file/x.webp" }),
    ),
    ...over,
  };
}

type FakePayload = ReturnType<typeof fakePayload>;

/** Invoke a beforeChange hook with a minimal context; returns the mutated data. */
async function run(
  hook: CollectionBeforeChangeHook,
  ctx: {
    data: Record<string, unknown>;
    originalDoc?: Record<string, unknown>;
    req: { payload: FakePayload; context?: Record<string, unknown> };
    collection?: { slug: string };
  },
): Promise<Record<string, unknown>> {
  // Payload always provides req.context; the hook reads skipImageGeneration off it.
  const withContext = { ...ctx, req: { context: {}, ...ctx.req } };
  return (await hook(
    withContext as unknown as Parameters<CollectionBeforeChangeHook>[0],
  )) as Record<string, unknown>;
}

const okImage = (format: ImageFormatSpec): GeneratedImage => ({
  format,
  data: Buffer.from("img"),
  mimetype: "image/webp",
  extension: "webp",
});

beforeEach(() => {
  generateOneImageMock.mockReset();
  generateOneImageMock.mockImplementation(({ format }) =>
    Promise.resolve(okImage(format)),
  );
  vi.stubEnv("S3_ACCESS_KEY_ID", "stub");
  vi.stubEnv("S3_SECRET_ACCESS_KEY", "secret");
  vi.stubEnv("AI_GATEWAY_API_KEY", "gw");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("generateImagesHook", () => {
  it("no prompt → no-op", async () => {
    const payload = fakePayload();
    const hook = generateImagesHook({ formats: FORMATS });
    const data = { title: "x" };
    const out = await run(hook, { data, originalDoc: undefined, req: { payload }, collection: { slug: "posts" } });
    expect(out).toBe(data);
    expect(generateOneImageMock).not.toHaveBeenCalled();
    expect(payload.create).not.toHaveBeenCalled();
  });

  it("skips when req.context.skipImageGeneration is set (seed path)", async () => {
    const payload = fakePayload();
    const hook = generateImagesHook({ formats: FORMATS });
    const data: Record<string, unknown> = { imagePrompt: "a fox" };
    await run(hook, {
      data,
      req: { payload, context: { skipImageGeneration: true } },
      collection: { slug: "posts" },
    });
    expect(generateOneImageMock).not.toHaveBeenCalled();
    expect(payload.create).not.toHaveBeenCalled();
  });

  it("fills both empty slots and attaches the new media ids", async () => {
    const payload = fakePayload();
    const hook = generateImagesHook({ formats: FORMATS });
    const data: Record<string, unknown> = { imagePrompt: "a fox" };
    await run(hook, { data, originalDoc: undefined, req: { payload }, collection: { slug: "posts" } });
    expect(generateOneImageMock).toHaveBeenCalledTimes(2);
    expect(payload.create).toHaveBeenCalledTimes(2);
    expect(data.imageHero).toBe(100);
    expect(data.imageOg).toBe(101);
    // alt defaults to the prompt
    const createArg = payload.create.mock.calls[0]?.[0];
    expect(createArg?.collection).toBe("media");
    expect(createArg?.data.alt).toBe("a fox");
  });

  it("leaves already-filled slots untouched (fill-missing semantics)", async () => {
    const payload = fakePayload();
    const hook = generateImagesHook({ formats: FORMATS });
    const data: Record<string, unknown> = { imagePrompt: "a fox" };
    // hero already set on the existing doc → only og should generate
    await run(hook, { data, originalDoc: { imageHero: 7 }, req: { payload }, collection: { slug: "posts" } });
    expect(generateOneImageMock).toHaveBeenCalledTimes(1);
    expect(generateOneImageMock.mock.calls[0]?.[0].format.key).toBe("og");
    expect(data.imageHero).toBeUndefined(); // untouched
    expect(data.imageOg).toBe(100);
  });

  it("per-format isolation: one failure is logged, the other still attaches", async () => {
    const payload = fakePayload();
    generateOneImageMock.mockImplementation(({ format }) =>
      format.key === "hero"
        ? Promise.reject(new Error("content-safety block"))
        : Promise.resolve(okImage(format)),
    );
    const hook = generateImagesHook({ formats: FORMATS });
    const data: Record<string, unknown> = { imagePrompt: "a fox" };
    const out = await run(hook, { data, originalDoc: undefined, req: { payload }, collection: { slug: "posts" } });
    expect(out).toBe(data); // never throws
    expect(data.imageHero).toBeUndefined(); // failed
    expect(data.imageOg).toBe(100); // succeeded
    expect(payload.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("content-safety block"),
    );
  });

  it("S3 guard runs FIRST: unconfigured storage → skip with one log, zero spend", async () => {
    vi.stubEnv("S3_ACCESS_KEY_ID", "");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "");
    // ...and ensure Supabase session-token mode can't satisfy the guard either.
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const payload = fakePayload();
    const hook = generateImagesHook({ formats: FORMATS });
    const data: Record<string, unknown> = { imagePrompt: "a fox" };
    await run(hook, { data, originalDoc: undefined, req: { payload }, collection: { slug: "posts" } });
    expect(generateOneImageMock).not.toHaveBeenCalled(); // no gateway spend
    expect(payload.create).not.toHaveBeenCalled();
    expect(payload.logger.warn).toHaveBeenCalledWith(expect.stringContaining("S3 storage not configured"));
  });

  it("kill switch: settings.enabled=false → skip", async () => {
    const payload = fakePayload({
      findGlobal: () => Promise.resolve({ enabled: false }),
    });
    const hook = generateImagesHook({ formats: FORMATS });
    const data: Record<string, unknown> = { imagePrompt: "a fox" };
    await run(hook, { data, originalDoc: undefined, req: { payload }, collection: { slug: "posts" } });
    expect(generateOneImageMock).not.toHaveBeenCalled();
    expect(payload.logger.info).toHaveBeenCalledWith(expect.stringContaining("disabled"));
  });

  it("caps formats at IMAGE_GENERATION_MAX_FORMATS", async () => {
    const many: ImageFormatSpec[] = Array.from({ length: 9 }, (_, i) => ({
      key: `k${i}`,
      field: `f${i}`,
      aspectRatio: "1:1",
      width: 100,
      height: 100,
      composition: "",
    }));
    const payload = fakePayload();
    const hook = generateImagesHook({ formats: many });
    const data: Record<string, unknown> = { imagePrompt: "p" };
    await run(hook, { data, originalDoc: undefined, req: { payload }, collection: { slug: "x" } });
    expect(generateOneImageMock.mock.calls.length).toBeLessThanOrEqual(6);
  });
});

describe("syncImageUrls", () => {
  it("caches the attached media's public URL into <field>Url", async () => {
    const payload = fakePayload();
    const hook = syncImageUrls({ formats: FORMATS });
    const data: Record<string, unknown> = { imageHero: 100 };
    await run(hook, { data, originalDoc: undefined, req: { payload } });
    expect(data[urlCacheField("imageHero")]).toBe("/cms-api/media/file/x.webp");
  });

  it("clears the cache when a slot is cleared", async () => {
    const payload = fakePayload();
    const hook = syncImageUrls({ formats: FORMATS });
    const data: Record<string, unknown> = { imageHero: null };
    await run(hook, { data, originalDoc: { imageHero: 5, imageHeroUrl: "/old" }, req: { payload } });
    expect(data.imageHeroUrl).toBeNull();
    expect(payload.findByID).not.toHaveBeenCalled();
  });
});
