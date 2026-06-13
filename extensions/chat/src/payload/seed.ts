import type { ExtSeedStep } from "@acme/ext-kit/payload";

/**
 * Demo chat skills — runs through the host's idempotent CMS seed flow so skill
 * routing is demonstrable out of the box. Skill routing stays OFF by default
 * (the settings global's skillsFeatureEnabled defaults to false); staff flip
 * it on under Extensions → AI Chat Settings → Skills.
 */
export const seed: ExtSeedStep[] = [
  {
    label: "Chat skills",
    run: async (payload) => {
      await payload.create({
        collection: "ext-chat-skills",
        data: {
          name: "Coding Helper",
          slug: "coding-helper",
          description:
            "Programming, debugging, and software architecture questions.",
          category: "Technical",
          priority: 50,
          isEnabled: true,
          personaPrompt:
            "You are a senior software engineer. Give precise, idiomatic " +
            "code and explain trade-offs concisely. Prefer runnable examples.",
          triggers: [
            { pattern: "code", patternType: "keyword", weight: 1 },
            { pattern: "bug", patternType: "keyword", weight: 1 },
            { pattern: "typescript", patternType: "keyword", weight: 1.5 },
            { pattern: "error", patternType: "keyword", weight: 1 },
            { pattern: "function", patternType: "keyword", weight: 1 },
          ],
        },
      });

      await payload.create({
        collection: "ext-chat-skills",
        data: {
          name: "Writing Coach",
          slug: "writing-coach",
          description:
            "Drafting, editing, and improving prose, emails, and copy.",
          category: "Content",
          priority: 60,
          isEnabled: true,
          personaPrompt:
            "You are an expert writing coach. Improve clarity, tone, and " +
            "structure. Offer concrete rewrites, not vague advice.",
          triggers: [
            { pattern: "write", patternType: "keyword", weight: 1 },
            { pattern: "essay", patternType: "keyword", weight: 1 },
            { pattern: "email", patternType: "keyword", weight: 1 },
            { pattern: "edit", patternType: "keyword", weight: 1 },
            { pattern: "rewrite", patternType: "keyword", weight: 1.5 },
          ],
        },
      });
    },
  },
];
