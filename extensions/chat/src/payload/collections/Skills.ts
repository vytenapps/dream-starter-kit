import type { CollectionConfig } from "payload";

import { isStaff } from "@acme/ext-kit/payload";

import { slugField } from "../fields/slug";

/**
 * Chat skills — the routable persona library for the assistant's bot brain
 * (ported from the Sendblue concierge). Each skill carries a persona prompt
 * that gets layered onto the universal prompt when the router selects it, plus
 * trigger patterns (keyword/synonym/regex) that drive deterministic keyword
 * routing. The router (src/server/routing.ts) reads enabled skills via the
 * Local API. Staff-managed; no draft/publish (the `isEnabled` flag gates use).
 */
export const Skills: CollectionConfig = {
  slug: "ext-chat-skills",
  labels: { singular: "Chat Skill", plural: "Chat Skills" },
  admin: {
    useAsTitle: "name",
    group: "AI Chat",
    defaultColumns: ["name", "category", "priority", "isEnabled"],
    description:
      "Routable assistant personas. When a user's message matches a skill's " +
      "triggers (or the LLM fallback picks it), its persona prompt is layered " +
      "onto the universal prompt for that turn.",
  },
  access: {
    read: isStaff,
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  fields: [
    {
      type: "row",
      fields: [
        {
          name: "name",
          type: "text",
          required: true,
          admin: { width: "60%" },
        },
        {
          name: "isEnabled",
          type: "checkbox",
          defaultValue: true,
          label: "Enabled",
          admin: { width: "40%" },
        },
      ],
    },
    slugField("name"),
    {
      name: "description",
      type: "textarea",
      admin: {
        description:
          "One line on when this skill applies — also shown to the LLM " +
          "fallback classifier when keyword routing is inconclusive.",
      },
    },
    {
      name: "category",
      type: "text",
      admin: {
        position: "sidebar",
        description: "Optional grouping for the admin list.",
      },
    },
    {
      name: "priority",
      type: "number",
      defaultValue: 100,
      admin: {
        position: "sidebar",
        description: "Tie-breaker when scores are equal — lower wins.",
      },
    },
    {
      name: "personaPrompt",
      type: "textarea",
      required: true,
      admin: {
        description:
          "Layered onto the universal prompt when this skill is selected.",
      },
    },
    {
      name: "triggers",
      type: "array",
      labels: { singular: "Trigger", plural: "Triggers" },
      admin: {
        description:
          "Keyword/synonym tokens or regex patterns that route to this skill.",
      },
      fields: [
        {
          type: "row",
          fields: [
            {
              name: "pattern",
              type: "text",
              required: true,
              admin: { width: "50%" },
            },
            {
              name: "patternType",
              type: "select",
              required: true,
              defaultValue: "keyword",
              options: [
                { label: "Keyword", value: "keyword" },
                { label: "Synonym", value: "synonym" },
                { label: "Regex", value: "regex" },
              ],
              admin: { width: "30%" },
            },
            {
              name: "weight",
              type: "number",
              defaultValue: 1,
              admin: { width: "20%" },
            },
          ],
        },
      ],
    },
  ],
};
