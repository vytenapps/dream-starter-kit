// KIT ADAPTATION (see VENDOR.md): upstream's customProvider/test-mock split is
// dropped. Model ids are Vercel AI Gateway slugs passed straight to the AI
// SDK (it reads AI_GATEWAY_API_KEY from the env); the catalog lives in
// @acme/config. Unknown ids fall back to the default (golden rule #5).

import { ROUTING_AI_MODEL } from "@acme/config";

import { allowedModelIds, DEFAULT_CHAT_MODEL } from "./models";

export function getLanguageModel(modelId: string): string {
  return allowedModelIds.has(modelId) ? modelId : DEFAULT_CHAT_MODEL;
}

export function getTitleModel(): string {
  return ROUTING_AI_MODEL;
}
