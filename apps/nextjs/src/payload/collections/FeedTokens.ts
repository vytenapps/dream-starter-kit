import type { CollectionConfig } from "payload";

import { ownsOrStaff } from "../access";
import { assignOwner } from "../hooks/assign-owner";

/**
 * Opaque per-member tokens for PRIVATE podcast feeds: podcast apps can't send
 * auth headers, so the credential lives in the feed URL
 * (`/feeds/:showSlug/:token/rss.xml`). The feed endpoint resolves token →
 * user → live entitlement on every fetch, so revoking (or churn) cuts access.
 */
export const FeedTokens: CollectionConfig = {
  slug: "feed-tokens",
  admin: {
    useAsTitle: "token",
    group: "People",
    defaultColumns: ["user", "show", "revoked", "lastAccessedAt"],
    description: "Tokenized private podcast feed URLs.",
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
      name: "token",
      type: "text",
      required: true,
      unique: true,
      index: true,
      defaultValue: () => crypto.randomUUID(),
      admin: {
        readOnly: true,
        description: "Opaque secret appearing in the feed URL.",
      },
    },
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
    },
    {
      name: "show",
      type: "relationship",
      relationTo: "series",
      filterOptions: { kind: { equals: "podcast" } },
      admin: { description: "Optional — scope to one podcast." },
    },
    {
      name: "revoked",
      type: "checkbox",
      defaultValue: false,
      admin: { description: "Kill switch — the feed stops resolving." },
    },
    {
      name: "lastAccessedAt",
      type: "date",
      admin: { readOnly: true, description: "Updated on each feed fetch." },
    },
  ],
};
