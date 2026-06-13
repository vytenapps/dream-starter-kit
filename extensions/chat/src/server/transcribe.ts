import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import { experimental_transcribe as transcribe } from "ai";

/**
 * Voice transcription (ported from the Sendblue concierge). The AI Gateway
 * doesn't proxy /audio/transcriptions, so this calls OpenAI directly with
 * OPENAI_API_KEY. The model string is "provider/model-id"; only openai/* is
 * wired up. Whisper accepts browser webm/opus directly — no ffmpeg on the web
 * path.
 */
export async function transcribeAudio(
  audio: Uint8Array,
  modelString: string,
): Promise<string> {
  const slash = modelString.indexOf("/");
  const provider =
    slash === -1 ? "" : modelString.slice(0, slash).toLowerCase();
  const modelId = slash === -1 ? modelString : modelString.slice(slash + 1);

  if (provider !== "openai") {
    throw new Error(
      `Unsupported transcription provider "${provider || "(none)"}". Only "openai/<model>" is wired up.`,
    );
  }

  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const result = await transcribe({
    model: openai.transcription(modelId),
    audio,
  });
  return result.text;
}
