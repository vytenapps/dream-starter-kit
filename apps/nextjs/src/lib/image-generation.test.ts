import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_IMAGE_MODEL } from "@acme/config";

import {
  CARD_FORMATS,
  composeImagePrompt,
  FEATURED_FORMATS,
  generateImages,
} from "./image-generation";

// Capture the args passed to the gateway + generateImage so we can assert prompt
// composition and model resolution without a live gateway.
const generateImageMock =
  vi.fn<(args: unknown) => Promise<{ image: { uint8Array: Uint8Array } }>>();
const imageModelMock = vi.fn<(slug: string) => { slug: string }>();

vi.mock("ai", () => ({
  experimental_generateImage: (args: unknown) => generateImageMock(args),
  gateway: { imageModel: (slug: string) => imageModelMock(slug) },
}));

/** Build a real PNG buffer so sharp has something valid to normalize. */
async function fakePng(): Promise<Uint8Array> {
  const buf = await sharp({
    create: {
      width: 32,
      height: 32,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buf);
}

beforeEach(() => {
  generateImageMock.mockReset();
  imageModelMock.mockClear();
});

describe("composeImagePrompt", () => {
  it("orders art-direction, subject, then composition", () => {
    const out = composeImagePrompt("ART", "a fox", "wide banner");
    expect(out).toBe("ART\n\nSubject: a fox\n\nComposition: wide banner");
  });

  it("omits the Composition line when empty", () => {
    const out = composeImagePrompt("ART", "a fox", "   ");
    expect(out).toBe("ART\n\nSubject: a fox");
  });
});

describe("preset format sets", () => {
  it("FEATURED is hero + OG; CARD adds a square", () => {
    expect(FEATURED_FORMATS.map((f) => f.key)).toEqual(["hero", "og"]);
    expect(CARD_FORMATS.map((f) => f.key)).toEqual(["hero", "og", "square"]);
    // Each format declares the upload field it fills.
    expect(CARD_FORMATS.map((f) => f.field)).toEqual([
      "imageHero",
      "imageOg",
      "imageSquare",
    ]);
  });
});

describe("generateImages", () => {
  beforeEach(async () => {
    const data = await fakePng();
    generateImageMock.mockResolvedValue({ image: { uint8Array: data } });
  });

  it("renders every format in parallel and normalizes to webp at the right size", async () => {
    const out = await generateImages({
      prompt: "a cozy reading nook",
      formats: FEATURED_FORMATS,
    });

    expect(out).toHaveLength(2);
    expect(generateImageMock).toHaveBeenCalledTimes(2);

    for (const img of out) {
      expect(img.mimetype).toBe("image/webp");
      expect(img.extension).toBe("webp");
      const meta = await sharp(img.data).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBe(img.format.width);
      expect(meta.height).toBe(img.format.height);
    }
  });

  it("defaults to DEFAULT_IMAGE_MODEL and passes each format's aspect ratio", async () => {
    await generateImages({ prompt: "x", formats: FEATURED_FORMATS });

    expect(imageModelMock).toHaveBeenCalledWith(DEFAULT_IMAGE_MODEL);
    const ratios = generateImageMock.mock.calls.map(
      (c) => (c[0] as { aspectRatio: string }).aspectRatio,
    );
    expect(ratios).toEqual(["16:9", "40:21"]);
  });

  it("honours an explicit model override", async () => {
    await generateImages({
      prompt: "x",
      model: "openai/gpt-image-1",
      formats: [FEATURED_FORMATS[0]],
    });
    expect(imageModelMock).toHaveBeenCalledWith("openai/gpt-image-1");
  });
});
