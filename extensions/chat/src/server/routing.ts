import "server-only";

import type { BasePayload } from "payload";
import { generateText } from "ai";

import type { ChatSettings } from "../payload/settings";

/**
 * Skill router — ported from the Sendblue concierge (lib/chat/skills.ts),
 * minus the SMS-specific onboarding/business-intake stage. Selection order:
 * stickiness → keyword/regex score → LLM fallback → universal-only. Skills
 * live in the ext-chat-skills CMS collection; this reads them via the Local
 * API with a short module cache.
 */

export type PatternType = "keyword" | "synonym" | "regex";

export interface SkillTrigger {
  pattern: string;
  patternType: PatternType;
  weight?: number | null;
}

export interface Skill {
  slug: string;
  name: string;
  description?: string | null;
  personaPrompt: string;
  priority: number;
  isEnabled: boolean;
  triggers?: SkillTrigger[] | null;
}

interface SkillsCache {
  skills: Skill[];
  bySlug: Map<string, Skill>;
  keywordIndex: Map<string, { slug: string; weight: number }[]>;
  regexTriggers: { slug: string; pattern: RegExp; weight: number }[];
  expires: number;
}

export interface SkillSelection {
  slug: string | null;
  persona: string | null;
  score: number;
  reason:
    | "stickiness"
    | "keyword"
    | "llm-fallback"
    | "default-universal"
    | "feature-disabled";
}

export interface ThreadSkillState {
  activeSkillSlug: string | null;
  activeSkillTurnsRemaining: number;
}

const CACHE_TTL_MS = 30_000;
let cache: SkillsCache | null = null;

export function invalidateSkillCache(): void {
  cache = null;
}

const TOKEN_SPLIT = /[^a-z0-9&\-/]+/;

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,!?;:()[\]{}"']/g, " ")
    .split(TOKEN_SPLIT)
    .filter(Boolean);
}

async function loadSkills(payload: BasePayload): Promise<SkillsCache> {
  const now = Date.now();
  if (cache && cache.expires > now) return cache;

  let skills: Skill[] = [];
  try {
    const res = await payload.find({
      collection: "ext-chat-skills",
      where: { isEnabled: { equals: true } },
      limit: 200,
      depth: 0,
    });
    skills = res.docs as unknown as Skill[];
  } catch {
    // Collection missing or CMS down — degrade to no skills (universal only).
    skills = [];
  }

  const bySlug = new Map<string, Skill>();
  const keywordIndex = new Map<string, { slug: string; weight: number }[]>();
  const regexTriggers: SkillsCache["regexTriggers"] = [];

  for (const skill of skills) {
    bySlug.set(skill.slug, skill);
    for (const t of skill.triggers ?? []) {
      const weight = t.weight ?? 1;
      if (t.patternType === "regex") {
        try {
          regexTriggers.push({
            slug: skill.slug,
            pattern: new RegExp(t.pattern, "i"),
            weight,
          });
        } catch {
          /* skip invalid regex */
        }
        continue;
      }
      const key = t.pattern.trim().toLowerCase();
      if (!key) continue;
      const list = keywordIndex.get(key) ?? [];
      list.push({ slug: skill.slug, weight });
      keywordIndex.set(key, list);
    }
  }

  cache = {
    skills,
    bySlug,
    keywordIndex,
    regexTriggers,
    expires: now + CACHE_TTL_MS,
  };
  return cache;
}

function scoreSkills(
  text: string,
  c: SkillsCache,
): { slug: string; score: number }[] {
  const lowered = text.toLowerCase();
  const tokens = new Set(tokenize(text));
  const scores = new Map<string, number>();

  const add = (slug: string, w: number) =>
    scores.set(slug, (scores.get(slug) ?? 0) + w);

  for (const tok of tokens) {
    for (const e of c.keywordIndex.get(tok) ?? []) add(e.slug, e.weight);
  }
  for (const [pattern, bucket] of c.keywordIndex.entries()) {
    if (pattern.includes(" ") && lowered.includes(pattern)) {
      for (const e of bucket) add(e.slug, e.weight);
    }
  }
  for (const r of c.regexTriggers) {
    if (r.pattern.test(lowered)) add(r.slug, r.weight);
  }

  return [...scores.entries()]
    .map(([slug, score]) => ({ slug, score }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const pa = c.bySlug.get(a.slug)?.priority ?? 999;
      const pb = c.bySlug.get(b.slug)?.priority ?? 999;
      return pa - pb;
    });
}

async function classifyWithLlm(
  userText: string,
  candidates: Skill[],
  model: string,
): Promise<string | null> {
  if (candidates.length === 0) return null;
  const options = candidates
    .map((s, i) => `${i + 1}. ${s.slug} — ${s.description ?? s.name}`)
    .join("\n");
  const prompt = `You are a routing classifier. Given the user's message, pick the single skill that best fits. Reply with JUST the slug, nothing else. If none fit, reply "none".

Options:
${options}

User message: """${userText}"""

Slug:`;
  try {
    const { text } = await generateText({ model, prompt, temperature: 0 });
    const picked = text.trim().toLowerCase().split(/\s+/)[0] ?? "";
    if (!picked || picked === "none") return null;
    return candidates.find((c) => c.slug === picked)?.slug ?? null;
  } catch {
    return null;
  }
}

export async function selectSkill(params: {
  payload: BasePayload;
  settings: ChatSettings;
  userText: string;
  thread: ThreadSkillState | null;
}): Promise<SkillSelection> {
  const { payload, settings, userText, thread } = params;

  if (!settings.skillsFeatureEnabled) {
    return {
      slug: null,
      persona: null,
      score: 0,
      reason: "feature-disabled",
    };
  }

  const c = await loadSkills(payload);
  if (c.skills.length === 0) {
    return { slug: null, persona: null, score: 0, reason: "default-universal" };
  }

  const scored = scoreSkills(userText, c);
  const top = scored[0];

  // 1. Stickiness: keep the active skill unless a clearly stronger candidate.
  const activeSlug = thread?.activeSkillSlug ?? null;
  const turnsLeft = thread?.activeSkillTurnsRemaining ?? 0;
  if (activeSlug && turnsLeft > 0) {
    const active = c.bySlug.get(activeSlug);
    if (active) {
      const stronger =
        top != null &&
        top.slug !== activeSlug &&
        top.score >= settings.keywordThreshold * 1.5;
      if (!stronger) {
        return {
          slug: active.slug,
          persona: active.personaPrompt,
          score: top?.score ?? 0,
          reason: "stickiness",
        };
      }
    }
  }

  // 2. Keyword threshold met.
  if (top && top.score >= settings.keywordThreshold) {
    const skill = c.bySlug.get(top.slug);
    if (skill) {
      return {
        slug: skill.slug,
        persona: skill.personaPrompt,
        score: top.score,
        reason: "keyword",
      };
    }
  }

  // 3. LLM fallback over the top-8 partial-score candidates.
  if (settings.useLlmFallback) {
    const candidates = scored
      .slice(0, 8)
      .map((s) => c.bySlug.get(s.slug))
      .filter((s): s is Skill => Boolean(s));
    if (candidates.length > 0) {
      const picked = await classifyWithLlm(
        userText,
        candidates,
        settings.llmFallbackModel,
      );
      const skill = picked ? c.bySlug.get(picked) : undefined;
      if (skill) {
        return {
          slug: skill.slug,
          persona: skill.personaPrompt,
          score: top?.score ?? 0,
          reason: "llm-fallback",
        };
      }
    }
  }

  // 4. Default: universal-only.
  return {
    slug: null,
    persona: null,
    score: top?.score ?? 0,
    reason: "default-universal",
  };
}
