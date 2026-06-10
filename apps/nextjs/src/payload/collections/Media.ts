import type { CollectionBeforeChangeHook, CollectionConfig } from "payload";
import sharp from "sharp";

import { anyone, isStaff } from "../access";

/**
 * Generate a tiny LQIP placeholder (data URL) for image uploads, stored on
 * `blurDataURL` for next/image-style blur-up rendering. Best-effort: failures
 * never block the upload.
 */
const generateBlurDataUrl: CollectionBeforeChangeHook = async ({
  data,
  req,
}) => {
  const file = req.file;
  if (!file?.data || !file.mimetype.startsWith("image/")) return data;
  try {
    const buf = await sharp(file.data)
      .resize(16, 16, { fit: "inside" })
      .webp({ quality: 30 })
      .toBuffer();
    return { ...data, blurDataURL: `data:image/webp;base64,${buf.toString("base64")}` };
  } catch {
    return data;
  }
};

/**
 * The general-purpose upload store (images, video, audio assets) — referenced
 * everywhere via `upload` fields. Files are offloaded to Supabase Storage
 * (`cms-media` bucket) by the S3 adapter configured in payload.config.ts.
 * Public-read; staff-only writes. Distinct from the `photos` and `audio`
 * content sections (which are their own upload collections).
 */
export const Media: CollectionConfig = {
  slug: "media",
  trash: true,
  folders: true,
  access: {
    read: anyone,
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  admin: { group: "Content" },
  defaultPopulate: {
    url: true,
    alt: true,
    sizes: true,
    blurDataURL: true,
    mimeType: true,
    width: true,
    height: true,
  },
  upload: {
    mimeTypes: ["image/*", "video/*", "audio/*"],
    imageSizes: [
      { name: "thumbnail", width: 400 },
      { name: "card", width: 768 },
      { name: "hero", width: 1600 },
    ],
    focalPoint: true,
  },
  hooks: { beforeChange: [generateBlurDataUrl] },
  fields: [
    { name: "alt", type: "text", required: true },
    { name: "caption", type: "text" },
    { name: "credit", type: "text" },
    {
      name: "blurDataURL",
      type: "text",
      admin: {
        readOnly: true,
        disableListColumn: true,
        description: "LQIP placeholder — generated on upload.",
      },
    },
    { name: "tags", type: "relationship", relationTo: "tags", hasMany: true },
  ],
};
