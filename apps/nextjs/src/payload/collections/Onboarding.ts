import type { CollectionConfig } from "payload";

import { anyone, isStaff } from "../access";
import { destinationField } from "../fields/destination";

/**
 * Ordered intro slides for the app's first-run flow. Each CTA pairs button
 * text with a reusable deep-link destination, so the final slide can land
 * anywhere in the web or Expo app. The app fetches active slides sorted by
 * `order` (see useOnboardingSlides in @acme/app).
 */
export const Onboarding: CollectionConfig = {
  slug: "onboarding",
  admin: {
    useAsTitle: "title",
    group: "Marketing",
    defaultColumns: ["title", "order", "isFinalSlide", "active"],
  },
  defaultSort: "order",
  access: {
    read: anyone,
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "body", type: "textarea" },
    { name: "image", type: "upload", relationTo: "media" },
    {
      name: "animation",
      type: "upload",
      relationTo: "media",
      admin: { description: "Lottie JSON (optional)." },
    },
    {
      name: "cta",
      type: "group",
      fields: [
        { name: "label", type: "text", admin: { description: "Button text." } },
        destinationField(),
      ],
    },
    {
      name: "secondaryCta",
      type: "group",
      admin: { description: "Optional “Skip”/secondary action." },
      fields: [{ name: "label", type: "text" }, destinationField()],
    },
    {
      name: "isFinalSlide",
      type: "checkbox",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description: "The “Get started” / finish screen.",
      },
    },
    {
      name: "order",
      type: "number",
      required: true,
      defaultValue: 0,
      admin: { position: "sidebar" },
    },
    {
      name: "backgroundColor",
      type: "text",
      admin: { description: "Hex (optional)." },
    },
    {
      name: "active",
      type: "checkbox",
      defaultValue: true,
      admin: { position: "sidebar" },
    },
  ],
};
