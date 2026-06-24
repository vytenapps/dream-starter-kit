import type { Field } from "payload";

/**
 * Content gating for monetized collections (posts, videos, audio, photos,
 * series, community spaces…). The app checks the member's active
 * subscription/entitlement against this value:
 *   - `public`  — anyone
 *   - `members` — any signed-in member
 *   - `premium` — active paid subscription (plans.entitlement = premium)
 */
export const accessLevelField = (
  defaultValue: "public" | "members" | "premium" = "public",
): Field => ({
  name: "accessLevel",
  type: "select",
  defaultValue,
  options: [
    { label: "Public", value: "public" },
    { label: "Members (logged in)", value: "members" },
    { label: "Premium (paid)", value: "premium" },
  ],
  admin: {
    position: "sidebar",
    description: "Who can view this content in the app.",
  },
});
