// KIT ADAPTATION (see VENDOR.md): the model catalog comes from @acme/config
// (CHAT_MODELS / DEFAULT_AI_MODEL — golden rule #5: gateway slugs live only
// there). Upstream's per-model gatewayOrder/reasoningEffort and the live
// capability probes are dropped — the curated Anthropic set all supports
// tools + vision via the gateway.

import { CHAT_MODELS, DEFAULT_AI_MODEL } from "@acme/config";

export const DEFAULT_CHAT_MODEL: string = DEFAULT_AI_MODEL;

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
};

export const chatModels: ChatModel[] = CHAT_MODELS.map((m) => ({ ...m }));

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    (acc[model.provider] ??= []).push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>,
);
