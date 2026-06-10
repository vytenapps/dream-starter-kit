import type { CollectionConfig } from "payload";

import { anyone, isStaff } from "../access";
import { linkField } from "../fields/link";

/**
 * In-app promos/announcements with a scheduling window and platform/audience
 * targeting. The app fetches active banners for a placement and filters by
 * the window/platform/audience client-side (see useBanners in @acme/app).
 */
export const Banners: CollectionConfig = {
  slug: "banners",
  admin: {
    useAsTitle: "title",
    group: "Marketing",
    defaultColumns: ["title", "variant", "placement", "startsAt", "endsAt"],
  },
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
    { name: "icon", type: "text" },
    {
      name: "variant",
      type: "select",
      required: true,
      defaultValue: "info",
      options: [
        { label: "Info", value: "info" },
        { label: "Promo", value: "promo" },
        { label: "Warning", value: "warning" },
        { label: "Announcement", value: "announcement" },
      ],
    },
    linkField("link", {
      description: "Optional CTA.",
      withLabel: true,
      withAppearance: true,
    }),
    {
      name: "placement",
      type: "select",
      required: true,
      defaultValue: "home",
      options: [
        { label: "Home", value: "home" },
        { label: "Global", value: "global" },
        { label: "Content", value: "content" },
        { label: "Onboarding", value: "onboarding" },
      ],
    },
    {
      name: "targetPlatform",
      type: "select",
      hasMany: true,
      options: [
        { label: "iOS", value: "ios" },
        { label: "Android", value: "android" },
        { label: "Web", value: "web" },
      ],
      admin: { description: "Empty = all platforms." },
    },
    {
      name: "audience",
      type: "select",
      defaultValue: "all",
      options: [
        { label: "Everyone", value: "all" },
        { label: "Guests", value: "guests" },
        { label: "Members", value: "members" },
      ],
    },
    {
      name: "startsAt",
      type: "date",
      index: true,
      admin: { date: { pickerAppearance: "dayAndTime" } },
    },
    {
      name: "endsAt",
      type: "date",
      index: true,
      admin: { date: { pickerAppearance: "dayAndTime" } },
    },
    {
      name: "priority",
      type: "number",
      defaultValue: 0,
      admin: { position: "sidebar", description: "Higher wins." },
    },
    {
      name: "dismissible",
      type: "checkbox",
      defaultValue: true,
      admin: { position: "sidebar" },
    },
    {
      name: "active",
      type: "checkbox",
      defaultValue: true,
      admin: { position: "sidebar" },
    },
  ],
};
