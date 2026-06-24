import type { GeneratedImagesConfig } from "./hooks/generate-images";
import { CARD_FORMATS, FEATURED_FORMATS } from "../lib/image-formats";

/**
 * The single source of truth for which collections opt into AI image
 * generation, and with which format set. Each collection imports its config
 * object from here and wires it into BOTH its `generatedImageFields(cfg)` field
 * set and its `[generateImagesHook(cfg), syncImageUrls(cfg)]` beforeChange array
 * — so the field set and the on-save hook can never drift. The bulk-regenerate
 * route (`app/api/cms/regenerate-images`) iterates IMAGE_COLLECTIONS to re-render
 * every doc against the current settings.
 *
 * To add image generation to a new collection: add a config + an IMAGE_COLLECTIONS
 * entry here, then import the config into the collection (see Posts.ts).
 *
 * FEATURED = hero 16:9 + OG 1200×630; CARD adds a 1:1 square for feed cards.
 */
export const postImages = {
  formats: FEATURED_FORMATS,
} satisfies GeneratedImagesConfig;
export const pageImages = {
  formats: FEATURED_FORMATS,
} satisfies GeneratedImagesConfig;
export const videoImages = {
  formats: FEATURED_FORMATS,
} satisfies GeneratedImagesConfig;
export const audioImages = {
  formats: FEATURED_FORMATS,
} satisfies GeneratedImagesConfig;
export const eventImages = {
  formats: CARD_FORMATS,
} satisfies GeneratedImagesConfig;
export const seriesImages = {
  formats: CARD_FORMATS,
} satisfies GeneratedImagesConfig;
export const locationImages = {
  formats: CARD_FORMATS,
} satisfies GeneratedImagesConfig;

/** A collection that has AI image generation enabled, plus its format config. */
export interface ImageCollection {
  slug: string;
  config: GeneratedImagesConfig;
}

/** Every image-enabled collection. Keep in sync with the configs above. */
export const IMAGE_COLLECTIONS: readonly ImageCollection[] = [
  { slug: "posts", config: postImages },
  { slug: "pages", config: pageImages },
  { slug: "videos", config: videoImages },
  { slug: "audio", config: audioImages },
  { slug: "events", config: eventImages },
  { slug: "series", config: seriesImages },
  { slug: "locations", config: locationImages },
] as const;
