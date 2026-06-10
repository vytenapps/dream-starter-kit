import type { CollectionConfig } from "payload";

import { anyone, isStaff } from "../access";

/**
 * Uploaded assets (images, audio, video posters). Files are offloaded to
 * Supabase Storage (`cms-media` bucket) by the S3 adapter configured in
 * payload.config.ts. Public-read; admin-only writes.
 */
export const Media: CollectionConfig = {
  slug: "media",
  access: {
    read: anyone,
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  admin: { group: "Content" },
  upload: {
    mimeTypes: ["image/*", "video/*", "audio/*"],
    imageSizes: [
      { name: "thumbnail", width: 400 },
      { name: "card", width: 768 },
      { name: "hero", width: 1600 },
    ],
    focalPoint: true,
  },
  fields: [
    { name: "alt", type: "text", required: true },
    { name: "caption", type: "text" },
  ],
};
