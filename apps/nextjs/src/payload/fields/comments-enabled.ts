import type { Field } from "payload";

/**
 * Per-document comment toggle. Added to every commentable collection
 * (community-posts, posts, videos, audio, photos, events, locations) and read
 * by the `comments` collection's create gate (payload/hooks/comments-gate.ts)
 * so members can only comment where it's switched on.
 */
export const commentsEnabledField = (defaultValue = false): Field => ({
  name: "commentsEnabled",
  type: "checkbox",
  defaultValue,
  admin: {
    position: "sidebar",
    description: "Allow members to comment on this item.",
  },
});
