import type { CollectionConfig } from "payload";

import { generatePreviewPath, previewBreakpoints } from "../../lib/preview";
import { isStaff, publishedOrStaff } from "../access";
import { pageBlocks } from "../blocks";
import { generatedImageFields } from "../fields/generated-images";
import { slugField } from "../fields/slug";
import { generateImagesHook, syncImageUrls } from "../hooks/generate-images";
import { pageImages } from "../image-collections";

/**
 * Marketing/legal pages, addressed by slug (home, about, contact, terms,
 * privacy). One collection (vs. five globals) keeps editing uniform: one "Pages"
 * list, shared SEO/draft handling, and a single `[slug]` public route. Add a new
 * page = add a row, no code.
 *
 * Each page is composed from a `layout` of Launch UI blocks (hero, features,
 * logos, stats, CTA, FAQ, prose) — see `../blocks` and the `RenderBlocks`
 * component that maps them to React sections.
 */
export const Pages: CollectionConfig = {
  slug: "pages",
  trash: true,
  admin: {
    useAsTitle: "title",
    group: "Marketing",
    defaultColumns: ["title", "slug", "_status"],
    // Live Preview: the admin iframe loads /next/preview, which enables draft
    // mode and renders the page's draft (see lib/preview + /next/preview route).
    livePreview: {
      url: ({ data }) =>
        generatePreviewPath({
          collection: "pages",
          slug: typeof data.slug === "string" ? data.slug : undefined,
        }),
      breakpoints: previewBreakpoints,
    },
    preview: (doc) =>
      generatePreviewPath({
        collection: "pages",
        slug: typeof doc.slug === "string" ? doc.slug : undefined,
      }),
  },
  versions: { drafts: { schedulePublish: true }, maxPerDoc: 25 },
  access: {
    read: publishedOrStaff,
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  hooks: {
    beforeChange: [generateImagesHook(pageImages), syncImageUrls(pageImages)],
  },
  fields: [
    { name: "title", type: "text", required: true },
    slugField(),
    {
      name: "layout",
      type: "blocks",
      labels: { singular: "Section", plural: "Sections" },
      blocks: pageBlocks,
    },
    {
      name: "showInNav",
      type: "checkbox",
      defaultValue: false,
      admin: { position: "sidebar" },
    },
    {
      name: "publishedAt",
      type: "date",
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    ...generatedImageFields(pageImages),
  ],
};
