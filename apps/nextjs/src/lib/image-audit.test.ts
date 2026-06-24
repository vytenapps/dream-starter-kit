import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_IMAGE_AUDIT_MODEL } from "@acme/config";

import type { ImageFormatSpec } from "./image-formats";
import { auditGeneratedImage, buildAuditPrompt } from "./image-audit";

// Capture generateObject args so we can assert the model + image part without a
// live gateway.
const generateObjectMock = vi.fn<
  (args: unknown) => Promise<{
    object: { meetsRequirements: boolean; reason: string };
  }>
>();
vi.mock("ai", () => ({
  generateObject: (args: unknown) => generateObjectMock(args),
}));

const HERO: ImageFormatSpec = {
  key: "hero",
  field: "imageHero",
  aspectRatio: "16:9",
  width: 1600,
  height: 900,
  composition: "wide landscape hero",
};

beforeEach(() => {
  generateObjectMock.mockReset();
});

describe("buildAuditPrompt", () => {
  it("embeds the subject, the format spec, and the strict reject rules", () => {
    const out = buildAuditPrompt("a red fox in snow", HERO);
    expect(out).toContain('"a red fox in snow"');
    expect(out).toContain('"hero" format (1600×900; wide landscape hero)');
    expect(out).toContain("meetsRequirements = false");
    expect(out).toContain("text, words, letters");
  });

  it("appends optional workspace instructions, and omits them when blank", () => {
    expect(buildAuditPrompt("x", HERO, "  must be photoreal  ")).toContain(
      "Additional requirements from the workspace: must be photoreal",
    );
    expect(buildAuditPrompt("x", HERO, "   ")).not.toContain(
      "Additional requirements",
    );
  });
});

describe("auditGeneratedImage", () => {
  it("maps the model verdict to { pass, reason } and defaults the model", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        meetsRequirements: true,
        reason: "Clearly depicts the subject.",
      },
    });
    const verdict = await auditGeneratedImage({
      bytes: Buffer.from("img"),
      mediaType: "image/webp",
      subject: "a red fox",
      format: HERO,
    });
    expect(verdict).toEqual({
      pass: true,
      reason: "Clearly depicts the subject.",
    });
    const arg = generateObjectMock.mock.calls[0]?.[0] as { model: string };
    expect(arg.model).toBe(DEFAULT_IMAGE_AUDIT_MODEL);
  });

  it("passes the image as an image message part and honors a model override", async () => {
    generateObjectMock.mockResolvedValue({
      object: { meetsRequirements: false, reason: "Contains text." },
    });
    const bytes = Buffer.from("bytes");
    const verdict = await auditGeneratedImage({
      bytes,
      mediaType: "image/webp",
      subject: "x",
      format: HERO,
      model: "anthropic/claude-opus-4.1",
    });
    expect(verdict.pass).toBe(false);
    const arg = generateObjectMock.mock.calls[0]?.[0] as {
      model: string;
      messages: { content: { type: string; image?: Buffer }[] }[];
    };
    expect(arg.model).toBe("anthropic/claude-opus-4.1");
    const parts = arg.messages[0]?.content ?? [];
    expect(parts.some((p) => p.type === "text")).toBe(true);
    expect(parts.find((p) => p.type === "image")?.image).toBe(bytes);
  });
});
