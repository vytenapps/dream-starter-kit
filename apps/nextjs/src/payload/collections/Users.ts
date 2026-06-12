import type { CollectionConfig } from "payload";
import { defaultTimezones } from "payload/shared";

import {
  adminFieldAccess,
  canAccessAdmin,
  isAdmin,
  isAdminOrSelf,
  staffFieldAccess,
} from "../access";
import { supabaseStrategy } from "../auth/supabase-strategy";
import { inviteUserOnCreate } from "../hooks/invite-user";
import { validateCustomFields } from "../hooks/validate-custom-fields";

/**
 * The single `users` collection: app members AND CMS staff, differentiated by
 * `roles` (WordPress-style). Authentication is bridged from Supabase Auth via a
 * custom SSO strategy — there is NO separate Payload login or password. A
 * `cms.users` row is provisioned on first access and linked to its Supabase
 * user by `supabaseUserId`. Only app users flagged `profiles.is_staff` may sign
 * in to /admin (and `access.admin` additionally requires a staff role). See
 * payload/auth/supabase-strategy.ts and docs/ARCHITECTURE.md.
 *
 * Every Supabase signup is mirrored here as a `member` (see
 * lib/cms/mirror-user.ts) so the admin Users page manages everyone — profiles,
 * tags, segmentation. Mirrored non-staff rows cannot access /admin.
 *
 * Creating a user here (new email) emails them a Supabase invite and grants
 * staff access. For an existing user, use "Grant staff access". The "User tags"
 * UI manages the Supabase `public.user_tags` segmentation (incl. the auto
 * plan-name tag from the Stripe webhook) — distinct from the CMS `tags`
 * relationship fields used for member interests. See payload/hooks/invite-user.ts.
 *
 * Soft delete (`trash: true`): removing a member moves the row to the Trash
 * (recoverable). The SSO bridge refuses trashed rows and the signup mirror
 * won't resurrect them — restore from the Trash view to re-enable.
 */
export const Users: CollectionConfig = {
  slug: "users",
  auth: {
    // SSO-only: Supabase is the single identity source. Disabling the local
    // strategy also removes Payload's password fields and create-first-user screen.
    disableLocalStrategy: true,
    strategies: [supabaseStrategy],
  },
  trash: true,
  // Trim what comes back when users are populated via relationships (post
  // authors, community feeds) — the single biggest mobile-payload lever.
  defaultPopulate: { displayName: true, username: true, avatar: true },
  admin: {
    useAsTitle: "displayName",
    group: "People",
    defaultColumns: ["displayName", "email", "roles", "memberStatus"],
    listSearchableFields: ["email", "displayName", "username"],
    description:
      "All app users — members and staff. Creating a NEW email emails a " +
      "Supabase invite and grants staff access; for an existing user use " +
      "“Grant staff access”. User tags (incl. the plan-name tag) are managed below.",
  },
  hooks: { beforeChange: [inviteUserOnCreate] },
  access: {
    admin: canAccessAdmin,
    create: isAdmin,
    read: isAdminOrSelf,
    update: isAdminOrSelf,
    delete: isAdmin,
  },
  fields: [
    // With the local strategy disabled Payload drops its built-in email field, so
    // we define our own — populated from the Supabase profile by the SSO bridge.
    { name: "email", type: "email", index: true },
    { name: "name", type: "text" },
    {
      name: "displayName",
      type: "text",
      admin: {
        description: "Public display name. Falls back to the account name.",
      },
      hooks: {
        beforeValidate: [
          ({ value, data, originalDoc }) => {
            if (typeof value === "string" && value.trim()) return value;
            const source = (data ?? originalDoc ?? {}) as {
              name?: string | null;
              email?: string | null;
            };
            return source.name ?? source.email?.split("@")[0] ?? undefined;
          },
        ],
      },
    },
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
      // No `saveToJWT`: it is inert under the SSO strategy — Payload never
      // mints its own token; the bridge resolves the user (and roles) from the
      // Supabase session on every request.
      name: "roles",
      type: "select",
      hasMany: true,
      required: true,
      defaultValue: ["member"],
      access: { update: adminFieldAccess },
      options: [
        { label: "Admin", value: "admin" },
        { label: "Editor", value: "editor" },
        { label: "Author", value: "author" },
        { label: "Member", value: "member" },
      ],
      admin: {
        position: "sidebar",
        description:
          "admin/editor/author may enter /admin (with staff access granted); " +
          "member is an app user.",
      },
    },
    {
      name: "memberStatus",
      type: "select",
      defaultValue: "active",
      options: [
        { label: "Active", value: "active" },
        { label: "Invited", value: "invited" },
        { label: "Suspended", value: "suspended" },
        { label: "Banned", value: "banned" },
      ],
      access: { update: staffFieldAccess },
      admin: { position: "sidebar" },
    },
    {
      type: "tabs",
      tabs: [
        {
          label: "Profile",
          fields: [
            {
              name: "username",
              type: "text",
              unique: true,
              index: true,
              admin: { description: "Public handle / profile URL slug." },
            },
            {
              type: "row",
              fields: [
                { name: "firstName", type: "text" },
                { name: "lastName", type: "text" },
              ],
            },
            { name: "pronouns", type: "text" },
            { name: "avatar", type: "upload", relationTo: "media" },
            {
              name: "coverImage",
              type: "upload",
              relationTo: "media",
              admin: { description: "Profile banner image." },
            },
            {
              name: "headline",
              type: "text",
              admin: { description: "Short tagline shown on the profile." },
            },
            {
              name: "bio",
              type: "textarea",
              admin: { description: "About — shown for author-role users." },
            },
            {
              type: "row",
              fields: [
                { name: "location", type: "text" },
                { name: "website", type: "text" },
              ],
            },
            {
              type: "row",
              fields: [
                { name: "company", type: "text" },
                { name: "jobTitle", type: "text" },
              ],
            },
            {
              name: "socialLinks",
              type: "group",
              fields: [
                { name: "twitter", type: "text" },
                { name: "instagram", type: "text" },
                { name: "linkedin", type: "text" },
                { name: "facebook", type: "text" },
                { name: "youtube", type: "text" },
                { name: "tiktok", type: "text" },
                { name: "github", type: "text" },
              ],
            },
            {
              name: "interests",
              type: "relationship",
              relationTo: "tags",
              hasMany: true,
              admin: { description: "Member interests / skills (CMS tags)." },
            },
            {
              name: "profileVisibility",
              type: "select",
              defaultValue: "members",
              options: [
                { label: "Public", value: "public" },
                { label: "Members", value: "members" },
                { label: "Private", value: "private" },
              ],
            },
            {
              name: "referralSource",
              type: "text",
              admin: { description: "How they found the app (optional)." },
            },
            {
              name: "tags",
              type: "relationship",
              relationTo: "tags",
              hasMany: true,
              access: { update: staffFieldAccess },
              admin: {
                description:
                  "Admin segmentation via CMS tags — distinct from the " +
                  "Supabase plan-name user tags managed below.",
              },
            },
            {
              name: "customFields",
              type: "json",
              validate: validateCustomFields,
              admin: {
                description:
                  "Values for the custom member fields defined in the " +
                  "profile-fields global.",
              },
            },
          ],
        },
        {
          label: "Contact",
          fields: [
            {
              name: "phone",
              type: "text",
              admin: { description: "Required before any SMS send." },
            },
            { name: "dateOfBirth", type: "date" },
            {
              name: "timezone",
              type: "select",
              // Payload's curated IANA list (stable + GraphQL-safe, unlike the
              // full ~400-entry Intl.supportedValuesOf set).
              options: [...defaultTimezones],
              admin: {
                description: "IANA timezone — used for scheduling and digests.",
              },
            },
            {
              name: "preferredLanguage",
              type: "select",
              options: [
                { label: "English", value: "en" },
                { label: "Spanish", value: "es" },
                { label: "French", value: "fr" },
                { label: "German", value: "de" },
                { label: "Portuguese", value: "pt" },
                { label: "Italian", value: "it" },
                { label: "Japanese", value: "ja" },
                { label: "Korean", value: "ko" },
                { label: "Chinese (Simplified)", value: "zh" },
              ],
            },
            {
              name: "address",
              type: "group",
              admin: { description: "Optional billing address." },
              fields: [
                { name: "street", type: "text" },
                {
                  type: "row",
                  fields: [
                    { name: "city", type: "text" },
                    { name: "region", type: "text" },
                  ],
                },
                {
                  type: "row",
                  fields: [
                    { name: "postalCode", type: "text" },
                    { name: "country", type: "text" },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: "Preferences",
          fields: [
            { name: "pushEnabled", type: "checkbox", defaultValue: false },
            {
              name: "smsOptIn",
              type: "checkbox",
              defaultValue: false,
              admin: {
                description:
                  "Explicit SMS consent — required before any SMS send; " +
                  "phone must be present.",
              },
            },
            { name: "marketingOptIn", type: "checkbox", defaultValue: false },
            {
              name: "notificationPreferences",
              type: "group",
              fields: [
                {
                  name: "emailDigest",
                  type: "select",
                  defaultValue: "off",
                  options: [
                    { label: "Off", value: "off" },
                    { label: "Daily", value: "daily" },
                    { label: "Weekly", value: "weekly" },
                  ],
                },
                {
                  name: "communityReplies",
                  type: "checkbox",
                  defaultValue: true,
                },
                { name: "mentions", type: "checkbox", defaultValue: true },
                {
                  name: "directMessages",
                  type: "checkbox",
                  defaultValue: true,
                },
                {
                  name: "productUpdates",
                  type: "checkbox",
                  defaultValue: false,
                },
              ],
            },
            {
              name: "onboardingCompleted",
              type: "checkbox",
              defaultValue: false,
            },
            {
              name: "lastActiveAt",
              type: "date",
              admin: {
                readOnly: true,
                description: "Updated on app launch.",
              },
            },
          ],
        },
        {
          label: "Billing",
          fields: [
            {
              name: "stripeCustomerID",
              type: "text",
              access: { read: staffFieldAccess },
              admin: { readOnly: true },
            },
          ],
        },
      ],
    },
    {
      // Billing (system extension) coupling — delete this join if you remove
      // the billing extension.
      name: "subscriptions",
      type: "join",
      collection: "ext-billing-subscriptions",
      on: "user",
    },
    {
      name: "favorites",
      type: "join",
      collection: "favorites",
      on: "user",
    },
    {
      name: "enrollments",
      type: "join",
      collection: "enrollments",
      on: "user",
    },
    {
      name: "devices",
      type: "join",
      collection: "device-tokens",
      on: "user",
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
