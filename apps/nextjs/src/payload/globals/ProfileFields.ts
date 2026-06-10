import type { GlobalConfig } from "payload";

import { anyone, isStaff } from "../access";

/**
 * Admin-defined custom member fields (Circle/Kajabi-style). Definitions here
 * drive the values stored in `users.customFields`, their validation (see
 * payload/hooks/validate-custom-fields.ts) and the profile-form UI — new
 * fields appear without a schema change or redeploy.
 */
export const ProfileFields: GlobalConfig = {
  slug: "profile-fields",
  admin: {
    group: "System",
    description: "Custom member profile fields stored in users.customFields.",
  },
  access: { read: anyone, update: isStaff },
  fields: [
    {
      name: "fields",
      type: "array",
      fields: [
        {
          name: "key",
          type: "text",
          required: true,
          admin: { description: "Stable key stored in users.customFields." },
        },
        { name: "label", type: "text", required: true },
        {
          name: "type",
          type: "select",
          required: true,
          defaultValue: "text",
          options: [
            { label: "Text", value: "text" },
            { label: "Textarea", value: "textarea" },
            { label: "Number", value: "number" },
            { label: "Select", value: "select" },
            { label: "Multi-select", value: "multiselect" },
            { label: "Checkbox", value: "checkbox" },
            { label: "Date", value: "date" },
            { label: "URL", value: "url" },
          ],
        },
        {
          name: "options",
          type: "array",
          admin: {
            condition: (_, s) =>
              s.type === "select" || s.type === "multiselect",
          },
          fields: [
            { name: "label", type: "text", required: true },
            { name: "value", type: "text", required: true },
          ],
        },
        { name: "required", type: "checkbox", defaultValue: false },
        {
          name: "visibility",
          type: "select",
          defaultValue: "members",
          options: [
            { label: "Public", value: "public" },
            { label: "Members", value: "members" },
            { label: "Private (member + admins)", value: "private" },
            { label: "Admin only", value: "admin" },
          ],
        },
        {
          name: "editableByMember",
          type: "checkbox",
          defaultValue: true,
        },
        { name: "order", type: "number", defaultValue: 0 },
      ],
    },
  ],
};
