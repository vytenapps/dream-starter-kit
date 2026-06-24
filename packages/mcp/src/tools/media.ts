import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { McpToolContext } from "../payload-context";
import { errorResult, jsonResult, runTool } from "./shared";

/**
 * The Media-library generation tool. `generate_media` mints a standalone,
 * reusable Media asset from a text prompt — distinct from setting `imagePrompt`
 * on a content doc (which auto-fills that doc's image slots via the collection
 * hook). The actual rendering is injected as `ctx.generateMedia` by the host
 * route handler (golden rule #6: staff-only — it runs as the verified staff
 * user with overrideAccess: false — and bounded to one image per call), so this
 * package stays free of `ai`/`sharp`. If the host didn't inject it (e.g. unit
 * tests, or generation unavailable), the tool simply isn't registered.
 */
export function registerMediaTools(
  server: McpServer,
  ctx: McpToolContext,
): void {
  const generateMedia = ctx.generateMedia;
  if (!generateMedia) return;

  server.registerTool(
    "generate_media",
    {
      title: "Generate media (AI image)",
      description:
        "Render an image from a text prompt via the AI Gateway and store it as " +
        "a reusable Media asset, returning its id + public URL (reference the id " +
        "from any upload field). `format`: hero (16:9), og (1200×630), or square " +
        "(1:1, default). Optional `alt` text (defaults to the prompt).",
      inputSchema: {
        prompt: z.string().min(1).describe("What to draw."),
        format: z.enum(["hero", "og", "square"]).optional(),
        alt: z.string().optional(),
      },
    },
    ({ prompt, format, alt }) =>
      runTool(async () => {
        try {
          const media = await generateMedia({ prompt, format, alt });
          return jsonResult({
            created: true,
            id: media.id,
            url: media.url,
            alt: media.alt,
          });
        } catch (err) {
          return errorResult(
            err instanceof Error
              ? `Image generation failed: ${err.message}`
              : "Image generation failed.",
          );
        }
      }),
  );
}
