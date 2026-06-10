import type { CollectionConfig } from "payload";

import { ownsOrStaff } from "../access";
import { assignOwner } from "../hooks/assign-owner";

/** Push tokens (FCM/APNs) registered per device, owned by a member. */
export const DeviceTokens: CollectionConfig = {
  slug: "device-tokens",
  admin: {
    useAsTitle: "token",
    group: "People",
    defaultColumns: ["user", "platform", "lastSeenAt"],
    description: "Push notification device registrations.",
  },
  access: {
    read: ownsOrStaff(),
    // create access cannot take a query constraint — owner is forced by hook.
    create: ({ req: { user } }) => Boolean(user),
    update: ownsOrStaff(),
    delete: ownsOrStaff(),
  },
  hooks: { beforeChange: [assignOwner()] },
  fields: [
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
    },
    {
      name: "token",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { description: "FCM/APNs token." },
    },
    {
      name: "platform",
      type: "select",
      required: true,
      options: [
        { label: "iOS", value: "ios" },
        { label: "Android", value: "android" },
        { label: "Web", value: "web" },
      ],
    },
    { name: "deviceModel", type: "text" },
    { name: "appVersion", type: "text" },
    { name: "osVersion", type: "text" },
    { name: "locale", type: "text" },
    { name: "pushEnabled", type: "checkbox", defaultValue: true },
    { name: "lastSeenAt", type: "date" },
  ],
};
