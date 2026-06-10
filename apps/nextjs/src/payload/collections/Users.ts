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
 * Creating a user here invites them as staff: a Supabase invite email goes out
 * (or, for an existing app user, their account is promoted without an email)
 * and `profiles.is_staff` is flagged. See payload/hooks/invite-user.ts.
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
    description:
      "Creating a user emails them a Supabase invite and grants staff access. " +
      "If the email already has an account, it is promoted to staff instead (no email is sent).",
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
  ],
};
