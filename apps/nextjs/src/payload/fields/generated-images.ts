import type { Field } from "payload";

import type { GeneratedImagesConfig } from "../hooks/generate-images";
import { urlCacheField } from "../hooks/generate-images";

/**
 * The reusable field set for AI-generated images. Returns, for the chosen
 * format set: one `upload`→`media` field per format, a `CopyImageUrl` UI control
 * beneath each (copies the cached public URL), the shared `imageAlt` + the
 * `imagePrompt` textarea that drives generation, and the hidden `<field>Url`
 * caches the public surfaces read. Pair with the two-hook beforeChange array
 * (generateImagesHook + syncImageUrls). See payload/hooks/generate-images.ts.
 *
 * Usage in a collection:
 *   fields: [ ..., ...generatedImageFields({ formats: FEATURED_FORMATS }) ]
 *   hooks: { beforeChange: [generateImagesHook(cfg), syncImageUrls(cfg)] }
 */
export function generatedImageFields(config: GeneratedImagesConfig): Field[] {
  const promptField = config.promptField ?? "imagePrompt";
  const altField = config.altField ?? "imageAlt";

  const perFormat: Field[] = config.formats.flatMap((format) => {
    const cache = urlCacheField(format.field);
    return [
      {
        name: format.field,
        type: "upload",
        relationTo: "media",
        admin: {
          description: `${format.key} image (${format.width}×${format.height}). Auto-generated from the prompt below when empty.`,
        },
      },
      {
        // Copies the cached public URL to the clipboard. Reads the hidden
        // `<field>Url` sibling (populated by syncImageUrls).
        name: `${format.field}CopyUrl`,
        type: "ui",
        admin: {
          components: {
            Field: {
              path: "~/payload/components/CopyImageUrl#CopyImageUrl",
              clientProps: { urlField: cache, label: `Copy ${format.key} URL` },
            },
          },
        },
      },
      {
        name: cache,
        type: "text",
        admin: {
          hidden: true,
          readOnly: true,
          disableListColumn: true,
          description: "Cached public URL — generated; do not edit.",
        },
      },
    ];
  });

  return [
    {
      name: promptField,
      type: "textarea",
      // Bound the prompt — it drives a cost-bearing AI-Gateway render on save.
      maxLength: 2000,
      admin: {
        description:
          "Describe the image(s) to generate. On save, empty slots above are " +
          "filled via the AI Gateway. Clear a slot to regenerate just that one.",
      },
    },
    {
      name: altField,
      type: "text",
      admin: {
        description:
          "Alt text for the generated image(s). Defaults to the prompt.",
      },
    },
    ...perFormat,
  ];
}
