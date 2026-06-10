import type { CollectionConfig } from "payload";

import { isAdmin } from "../access";
import { supabaseStrategy } from "../auth/supabase-strategy";
import { inviteUserOnCreate } from "../hooks/invite-user";

/**
 * Payload admin users (content editors / staff). Authentication is bridged from
 * Supabase Auth via a custom SSO strategy — there is NO separate Payload login or
 * password. A `cms.users` row is provisioned on first access and linked to its
 * Supabase user by `supabaseUserId`. Only app users flagged `profiles.is_staff`
 * may sign in. See payload/auth/supabase-strategy.ts and docs/ARCHITECTURE.md.
 *
 * This collection represents ALL app users — every Supabase signup is mirrored
 * here (see lib/cms/mirror-user.ts) so the admin can manage everyone and their
 * tags. Admin LOGIN is still gated on `profiles.is_staff` by the SSO strategy,
 * so mirrored non-staff rows can't access /admin.
 *
 * Creating a user here (new email) emails them a Supabase invite and grants
 * staff access. For an existing user, use "Grant staff access". Tags shown here
 * live in Supabase and include the auto plan-name tag from the Stripe webhook.
 * See payload/hooks/invite-user.ts.
 */
export const Users: CollectionConfig = {
  slug: "users",
  auth: {
    // SSO-only: Supabase is the single identity source. Disabling the local
    // strategy also removes Payload's password fields and create-first-user screen.
    disableLocalStrategy: true,
    strategies: [supabaseStrategy],
  },
  admin: {
    useAsTitle: "email",
    group: "Admin",
    defaultColumns: ["email", "name", "role"],
    description:
      "All app users. Creating a NEW email emails a Supabase invite and grants " +
      "staff access; for an existing user use “Grant staff access”. Tags " +
      "(incl. the plan-name tag) are managed below.",
  },
  hooks: { beforeChange: [inviteUserOnCreate] },
  access: {
    create: isAdmin,
    read: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    // With the local strategy disabled Payload drops its built-in email field, so
    // we define our own — populated from the Supabase profile by the SSO bridge.
    { name: "email", type: "email", index: true },
    { name: "name", type: "text" },
    {
      name: "supabaseUserId",
      type: "text",
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description:
          "Linked Supabase auth user id (managed by the SSO bridge).",
      },
    },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "editor",
      saveToJWT: true,
      options: [
        { label: "Admin", value: "admin" },
        { label: "Editor", value: "editor" },
      ],
    },
    {
      name: "tagsManager",
      type: "ui",
      admin: {
        components: {
          Field: "~/payload/components/UserTagsManager#UserTagsManager",
        },
      },
    },
    {
      name: "grantStaff",
      type: "ui",
      admin: {
        position: "sidebar",
        components: {
          Field: "~/payload/components/GrantStaffButton#GrantStaffButton",
        },
      },
    },
  ],
};
