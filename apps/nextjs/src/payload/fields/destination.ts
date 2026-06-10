import type { Field } from "payload";

/**
 * Reusable deep-link destination — "where does this go". Used by onboarding
 * CTAs, banners and community-post links. One stored value resolves to both a
 * web route and an Expo deep link:
 *   - `page`      — internal content (the client maps collection + slug to its route)
 *   - `appScreen` — a web route or Expo screen key (+ optional `params`)
 *   - `url`       — an external URL
 */
export const destinationField = (name = "destination"): Field => ({
  name,
  type: "group",
  fields: [
    {
      name: "type",
      type: "radio",
      defaultValue: "page",
      options: [
        { label: "Page / content", value: "page" },
        { label: "App screen", value: "appScreen" },
        { label: "External URL", value: "url" },
      ],
    },
    {
      name: "page",
      type: "relationship",
      relationTo: [
        "pages",
        "posts",
        "videos",
        "audio",
        "series",
        "events",
        "locations",
      ],
      admin: { condition: (_, s) => s.type === "page" },
    },
    {
      name: "screen",
      type: "text",
      admin: {
        condition: (_, s) => s.type === "appScreen",
        description:
          "Web route or Expo screen key, e.g. /courses/intro/lessons/1",
      },
    },
    {
      name: "params",
      type: "json",
      admin: { condition: (_, s) => s.type === "appScreen" },
    },
    {
      name: "url",
      type: "text",
      admin: { condition: (_, s) => s.type === "url" },
    },
  ],
});
