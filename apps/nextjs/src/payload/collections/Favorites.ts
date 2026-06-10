import type { CollectionConfig } from "payload";

import { ownsOrStaff } from "../access";
import { uniquePolymorphic } from "../hooks/unique-polymorphic";

/**
 * Member favorites/bookmarks — a join collection with a polymorphic target.
 * One row per user+target, enforced by the `uniquePolymorphic` hook (a DB
 * compound unique index can't span the polymorphic `_rels` table).
 */
export const Favorites: CollectionConfig = {
  slug: "favorites",
  admin: {
    group: "People",
    defaultColumns: ["user", "target", "createdAt"],
    description: "Member bookmarks across content types.",
  },
  access: {
    read: ownsOrStaff(),
    create: ownsOrStaff(),
    update: ownsOrStaff(),
    delete: ownsOrStaff(),
  },
  hooks: {
    beforeValidate: [
      uniquePolymorphic({
        collection: "favorites",
        ownerField: "user",
        message: "Already favorited.",
      }),
    ],
  },
  fields: [
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
    },
    {
      name: "target",
      type: "relationship",
      relationTo: ["posts", "videos", "audio", "photos", "locations", "events"],
      required: true,
    },
    {
      name: "notes",
      type: "text",
      admin: { description: "Personal note (optional)." },
    },
  ],
};
