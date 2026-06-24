import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ImageAuditVerdict } from "./image-audit";
import type { ImageFormatSpec, ResolvedAuditSettings } from "./image-formats";
import { generateAuditedImage } from "./image-generation";

// generateOneImage (in image-generation.ts) calls the AI SDK + sharp; feed it a
// real PNG so it produces a valid webp. We count generateImage calls = attempts.
const generateImageMock =
  vi.fn<(args: unknown) => Promise<{ image: { uint8Array: Uint8Array } }>>();
vi.mock("ai", () => ({
  experimental_generateImage: (args: unknown) => generateImageMock(args),
  gateway: { imageModel: (slug: string) => ({ slug }) },
}));

// Audit verdict is controlled per-attempt.
const auditMock = vi.fn<() => Promise<ImageAuditVerdict>>();
vi.mock("./image-audit", () => ({
  auditGeneratedImage: () => auditMock(),
}));

const HERO: ImageFormatSpec = {
  key: "hero",
  field: "imageHero",
  aspectRatio: "16:9",
  width: 64,
  height: 36,
  composition: "wide",
};

const auditOff: ResolvedAuditSettings = {
  enabled: false,
  maxAttempts: 3,
  failureAction: "publish",
};
const auditOn = (
  over?: Partial<ResolvedAuditSettings>,
): ResolvedAuditSettings => ({
  enabled: true,
  maxAttempts: 3,
  failureAction: "publish",
  ...over,
});

async function fakePng(): Promise<Uint8Array> {
  const buf = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: { r: 1, g: 2, b: 3 },
    },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buf);
}

const base = { model: "m", systemPrompt: "sp", subject: "a fox", format: HERO };

beforeEach(async () => {
  generateImageMock.mockReset();
  auditMock.mockReset();
  const data = await fakePng();
  generateImageMock.mockResolvedValue({ image: { uint8Array: data } });
});

describe("generateAuditedImage", () => {
  it("audit OFF: a single generation, returned as-is", async () => {
    const out = await generateAuditedImage({ ...base, audit: auditOff });
    expect(generateImageMock).toHaveBeenCalledTimes(1);
    expect(auditMock).not.toHaveBeenCalled();
    expect(out.passed).toBe(true);
    expect(out.attempts).toBe(1);
    expect(out.image).not.toBeNull();
  });

  it("audit OFF: a generation error yields image:null (caller skips), no throw", async () => {
    generateImageMock.mockRejectedValueOnce(new Error("content-safety block"));
    const out = await generateAuditedImage({ ...base, audit: auditOff });
    expect(out.image).toBeNull();
    expect(out.passed).toBe(false);
    expect(out.reason).toContain("content-safety block");
  });

  it("audit ON: returns the first image that passes", async () => {
    auditMock.mockResolvedValue({ pass: true, reason: "good" });
    const out = await generateAuditedImage({ ...base, audit: auditOn() });
    expect(generateImageMock).toHaveBeenCalledTimes(1);
    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(out.passed).toBe(true);
    expect(out.attempts).toBe(1);
  });

  it("audit ON: regenerates until it passes within maxAttempts", async () => {
    auditMock
      .mockResolvedValueOnce({ pass: false, reason: "has text" })
      .mockResolvedValueOnce({ pass: false, reason: "garbled" })
      .mockResolvedValueOnce({ pass: true, reason: "ok" });
    const events: string[] = [];
    const out = await generateAuditedImage({
      ...base,
      audit: auditOn(),
      onEvent: (m) => events.push(m),
    });
    expect(generateImageMock).toHaveBeenCalledTimes(3);
    expect(out.passed).toBe(true);
    expect(out.attempts).toBe(3);
    expect(events.filter((e) => e.startsWith("audit rejected"))).toHaveLength(
      2,
    );
  });

  it("audit ON + publish: keeps the last image when none passes", async () => {
    auditMock.mockResolvedValue({ pass: false, reason: "never good" });
    const out = await generateAuditedImage({
      ...base,
      audit: auditOn({ maxAttempts: 2, failureAction: "publish" }),
    });
    expect(generateImageMock).toHaveBeenCalledTimes(2);
    expect(out.passed).toBe(false);
    expect(out.image).not.toBeNull();
    expect(out.reason).toBe("never good");
  });

  it("audit ON + skip: attaches nothing when none passes", async () => {
    auditMock.mockResolvedValue({ pass: false, reason: "never good" });
    const out = await generateAuditedImage({
      ...base,
      audit: auditOn({ maxAttempts: 2, failureAction: "skip" }),
    });
    expect(out.passed).toBe(false);
    expect(out.image).toBeNull();
  });

  it("audit ON: a judge infra error fails OPEN (accepts the image)", async () => {
    auditMock.mockRejectedValue(new Error("gateway 503"));
    const out = await generateAuditedImage({ ...base, audit: auditOn() });
    expect(generateImageMock).toHaveBeenCalledTimes(1);
    expect(out.passed).toBe(true);
    expect(out.image).not.toBeNull();
    expect(out.reason).toBe("audit unavailable");
  });
});
