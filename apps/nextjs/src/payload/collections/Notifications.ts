import type { CollectionConfig } from "payload";

import { isStaff } from "../access";

/**
 * Staff-authored notifications across channels (push/email/SMS/in-app).
 * Sending is performed by a job/edge worker that reads `scheduledAt`, honors
 * per-user opt-ins (`pushEnabled`, `smsOptIn` + a present phone) and writes
 * back `sentAt`/`sentCount`. Plain `status` select is safe here — drafts are
 * OFF (the reserved-name collision only exists with versions enabled).
 */
export const Notifications: CollectionConfig = {
  slug: "notifications",
  trash: true,
  admin: {
    useAsTitle: "title",
    group: "Marketing",
    defaultColumns: ["title", "channel", "status", "scheduledAt", "sentAt"],
  },
  access: {
    read: isStaff,
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "body", type: "textarea" },
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      admin: { description: "Rich push image." },
    },
    {
      name: "deepLink",
      type: "text",
      admin: { description: "In-app route to open, e.g. /posts/welcome." },
    },
    {
      name: "data",
      type: "json",
      admin: {
        disableListColumn: true,
        description: "Custom key/value payload.",
      },
    },
    {
      name: "channel",
      type: "select",
      hasMany: true,
      required: true,
      defaultValue: ["push"],
      options: [
        { label: "Push", value: "push" },
        { label: "Email", value: "email" },
        { label: "SMS", value: "sms" },
        { label: "In-app", value: "in_app" },
      ],
    },
    {
      name: "smsBody",
      type: "text",
      maxLength: 160,
      admin: {
        condition: (data) =>
          Array.isArray(data.channel) && data.channel.includes("sms"),
        description:
          "Short SMS variant (≤160 chars). Sends require smsOptIn + phone.",
      },
    },
    {
      name: "audience",
      type: "select",
      required: true,
      defaultValue: "all",
      options: [
        { label: "All members", value: "all" },
        { label: "Segment", value: "segment" },
        { label: "Specific users", value: "users" },
      ],
    },
    {
      name: "segment",
      type: "json",
      admin: {
        condition: (data) => data.audience === "segment",
        description: "Filter criteria for the send job.",
      },
    },
    {
      name: "targetUsers",
      type: "relationship",
      relationTo: "users",
      hasMany: true,
      admin: { condition: (data) => data.audience === "users" },
    },
    {
      name: "scheduledAt",
      type: "date",
      admin: { date: { pickerAppearance: "dayAndTime" } },
    },
    {
      name: "sentAt",
      type: "date",
      admin: { readOnly: true, description: "Set by the send job." },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Scheduled", value: "scheduled" },
        { label: "Sending", value: "sending" },
        { label: "Sent", value: "sent" },
        { label: "Failed", value: "failed" },
      ],
      admin: { position: "sidebar" },
    },
    {
      type: "row",
      fields: [
        {
          name: "sentCount",
          type: "number",
          defaultValue: 0,
          admin: { readOnly: true },
        },
        {
          name: "openCount",
          type: "number",
          defaultValue: 0,
          admin: { readOnly: true },
        },
      ],
    },
  ],
};
