import "server-only";

import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  stepCountIs,
  streamText,
} from "ai";
import { z } from "zod/v4";

import type { Json } from "@acme/api";
import type { ChatChannel } from "@acme/config";
import type { ExtRouteContext, ExtRouteTable } from "@acme/ext-kit/server";
import {
  AI_MAX_OUTPUT_TOKENS,
  CHAT_CHANNELS,
  DEFAULT_AI_MODEL,
} from "@acme/config";
import { getExtensionSettings } from "@acme/ext-kit/payload";

import type { ChatSettings } from "../payload/settings";
import type { ChatMessage } from "../vendor/lib/types";
import type { ThreadSkillState } from "./routing";
import { settings } from "../payload/settings";
import { chatModels } from "../vendor/lib/ai/models";
import { titlePrompt } from "../vendor/lib/ai/prompts";
import { getLanguageModel, getTitleModel } from "../vendor/lib/ai/providers";
import { createDocument } from "../vendor/lib/ai/tools/create-document";
import { editDocument } from "../vendor/lib/ai/tools/edit-document";
import { getWeather } from "../vendor/lib/ai/tools/get-weather";
import { requestSuggestions } from "../vendor/lib/ai/tools/request-suggestions";
import { updateDocument } from "../vendor/lib/ai/tools/update-document";
import {
  deleteChatById,
  deleteDocumentsByIdAfterTimestamp,
  deleteMessagesByChatIdAfterTimestamp,
  getChatById,
  getChatsByUserId,
  getDocumentsById,
  getMessageById,
  getMessagesByChatId,
  getSuggestionsByDocumentId,
  getVotesByChatId,
  saveChat,
  saveDocument,
  saveMessages,
  updateChatLastContextById,
  updateChatTitleById,
  updateDocumentContent,
  updateMessage,
  voteMessage,
} from "../vendor/lib/db/queries";
import { ChatbotError } from "../vendor/lib/errors";
import {
  convertToUIMessages,
  generateUUID,
  getTextFromMessage,
} from "../vendor/lib/utils";
import { composeSystemPrompt, persistSkillState } from "./prompt";
import { transcribeAudio } from "./transcribe";

// Channel framework — the typed service that chat-adapter-* extensions call
// from their webhooks (the kit's cross-extension "plain typed export" pattern).
export {
  handleChannelMessage,
  type HandleChannelMessageParams,
  type HandleChannelMessageResult,
} from "./channel";
// Reused by channel adapters for voice-memo transcription.
export { transcribeAudio } from "./transcribe";

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status });

const parseChannel = (channel: string | undefined): ChatChannel =>
  channel && (CHAT_CHANNELS as readonly string[]).includes(channel)
    ? (channel as ChatChannel)
    : "web";

async function getThreadSkillState(
  supabase: ExtRouteContext["supabase"],
  threadId: string,
): Promise<ThreadSkillState | null> {
  const { data } = await supabase
    .from("ext_chat_threads")
    .select("active_skill_slug, active_skill_turns_remaining")
    .eq("id", threadId)
    .maybeSingle();
  if (!data) return null;
  return {
    activeSkillSlug: data.active_skill_slug,
    activeSkillTurnsRemaining: data.active_skill_turns_remaining,
  };
}

const requireGateway = () =>
  process.env.AI_GATEWAY_API_KEY
    ? null
    : json(503, { error: "AI is not configured" });

/** Upstream vercel/ai-chatbot request body (see VENDOR.md). `channel` feeds
 * the prompt composer; `selectedVisibilityType` is accepted but ignored
 * (chats are private this phase). */
const textPartSchema = z.object({
  type: z.literal("text"),
  text: z.string().min(1).max(8000),
});
const filePartSchema = z.object({
  type: z.literal("file"),
  mediaType: z.enum(["image/jpeg", "image/png"]),
  name: z.string().min(1).max(100),
  url: z.string().url(),
});
const userMessageSchema = z.object({
  id: z.uuid(),
  role: z.literal("user"),
  parts: z.array(z.union([textPartSchema, filePartSchema])),
});
const streamBodySchema = z.object({
  id: z.uuid(),
  message: userMessageSchema.optional(),
  messages: z
    .array(
      z.object({
        id: z.string(),
        role: z.enum(["user", "assistant"]),
        parts: z.array(z.record(z.string(), z.unknown())),
      }),
    )
    .optional(),
  selectedChatModel: z.string().optional(),
  selectedVisibilityType: z.string().optional(),
  channel: z.string().optional(),
});

/** Legacy body shape the native screens still send ({threadId, text}). */
const legacyBodySchema = z.object({
  threadId: z.uuid(),
  text: z.string().min(1).max(4000),
});

async function generateTitle(message: ChatMessage): Promise<string> {
  const { text } = await generateText({
    model: getTitleModel(),
    system: titlePrompt,
    prompt: getTextFromMessage(message),
  });
  return text
    .replace(/^[#*"\s]+/, "")
    .replace(/["]+$/, "")
    .trim();
}

/**
 * Legacy non-streaming turn for the native screens: persists the user turn,
 * generates with the admin-configured prompt, persists the reply. Kept until
 * the native screens move to useChat streaming.
 */
async function legacyStream(
  body: z.infer<typeof legacyBodySchema>,
  ctx: ExtRouteContext,
): Promise<Response> {
  const { threadId, text } = body;

  const insertUser = await ctx.supabase
    .from("ext_chat_messages")
    .insert({ thread_id: threadId, role: "user", content: text });
  if (insertUser.error) return json(403, { error: "Thread not found" });

  const chatSettings = await getExtensionSettings<ChatSettings>(
    await ctx.getPayload(),
    settings,
  );

  const { data: history } = await ctx.supabase
    .from("ext_chat_messages")
    .select("role, content")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  const messages = (history ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-chatSettings.maxHistoryMessages)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const { system } = await composeSystemPrompt({
    payload: await ctx.getPayload(),
    supabase: ctx.supabase,
    settings: chatSettings,
    channel: "native",
    userText: text,
    thread: null,
  });

  try {
    const result = await generateText({
      model: DEFAULT_AI_MODEL,
      system,
      messages,
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
    });

    await ctx.supabase.from("ext_chat_messages").insert({
      thread_id: threadId,
      role: "assistant",
      content: result.text,
      token_usage: result.usage as unknown as Json,
    });

    return Response.json({
      message: { role: "assistant", content: result.text },
      usage: result.usage,
    });
  } catch (e) {
    return json(500, {
      error: e instanceof Error ? e.message : "AI request failed",
    });
  }
}

/**
 * The vendored Chat SDK surface, served via the host dispatcher at
 * /api/ext/chat/* — every route below is already authenticated + rate-limited
 * (golden rule #6) and queries run through the caller's RLS-scoped client.
 * Ids travel as query strings (the dispatcher matches exact "METHOD /path"
 * keys). Model ids come from @acme/config (golden rule #5).
 */
export const routes: ExtRouteTable = {
  "POST /stream": async (req, ctx) => {
    const unconfigured = requireGateway();
    if (unconfigured) return unconfigured;

    const raw: unknown = await req.json().catch(() => null);

    // Native back-compat: {threadId, text} → buffered turn.
    const legacy = legacyBodySchema.safeParse(raw);
    if (legacy.success) return legacyStream(legacy.data, ctx);

    const parsed = streamBodySchema.safeParse(raw);
    if (parsed.success === false) {
      return new ChatbotError("bad_request:api").toResponse();
    }
    const { id, message, messages, selectedChatModel, channel } = parsed.data;

    const chatModel = getLanguageModel(selectedChatModel ?? DEFAULT_AI_MODEL);
    const session = { user: { id: ctx.user.id }, db: ctx.supabase };
    const payload = await ctx.getPayload();

    const chatSettings = await getExtensionSettings<ChatSettings>(
      payload,
      settings,
    );

    const isToolApprovalFlow = Boolean(messages);

    const chat = await getChatById(ctx.supabase, { id });
    let messagesFromDb: Awaited<ReturnType<typeof getMessagesByChatId>> = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      // RLS already scopes reads to the owner; a thread that exists but isn't
      // ours is invisible, so reaching here with a mismatch is impossible.
      messagesFromDb = await getMessagesByChatId(ctx.supabase, { id });
    } else if (message?.role === "user") {
      await saveChat(ctx.supabase, {
        id,
        userId: ctx.user.id,
        title: "New chat",
        visibility: "private",
      });
      titlePromise = generateTitle(message as ChatMessage);
    }

    let uiMessages: ChatMessage[];

    if (isToolApprovalFlow && messages) {
      const dbMessages = convertToUIMessages(messagesFromDb);
      const approvalStates = new Map(
        messages.flatMap((m) =>
          m.parts
            .filter(
              (p) =>
                p.state === "approval-responded" || p.state === "output-denied",
            )
            .map(
              (p) =>
                [
                  typeof p.toolCallId === "string" ? p.toolCallId : "",
                  p,
                ] as const,
            ),
        ),
      );
      uiMessages = dbMessages.map((msg) => ({
        ...msg,
        parts: msg.parts.map((part) => {
          if (
            "toolCallId" in part &&
            approvalStates.has(String(part.toolCallId))
          ) {
            return { ...part, ...approvalStates.get(String(part.toolCallId)) };
          }
          return part;
        }),
      })) as ChatMessage[];
    } else {
      uiMessages = [
        ...convertToUIMessages(messagesFromDb).slice(
          -chatSettings.maxHistoryMessages,
        ),
        message as ChatMessage,
      ];
    }

    if (message?.role === "user") {
      await saveMessages(ctx.supabase, {
        messages: [
          {
            chatId: id,
            id: message.id,
            role: "user",
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });
    }

    const modelMessages = await convertToModelMessages(uiMessages);

    // Compose the channel-aware system prompt (universal + channel sub-prompts
    // + routed skill persona + artifacts) and remember the prior skill state
    // so stickiness can be persisted after the turn.
    const latestUserText = message
      ? getTextFromMessage(message as ChatMessage)
      : "";
    const priorSkillState: ThreadSkillState | null = chat
      ? await getThreadSkillState(ctx.supabase, id)
      : null;
    const composed = await composeSystemPrompt({
      payload,
      supabase: ctx.supabase,
      settings: chatSettings,
      channel: parseChannel(channel),
      userText: latestUserText,
      thread: priorSkillState,
    });

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: ({ writer: dataStream }) => {
        const result = streamText({
          model: chatModel,
          system: composed.system,
          messages: modelMessages,
          stopWhen: stepCountIs(5),
          maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
          tools: {
            getWeather,
            createDocument: createDocument({
              session,
              dataStream,
              modelId: chatModel,
            }),
            editDocument: editDocument({ dataStream, session }),
            updateDocument: updateDocument({
              session,
              dataStream,
              modelId: chatModel,
            }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
              modelId: chatModel,
            }),
          },
        });

        dataStream.merge(result.toUIMessageStream({ sendReasoning: false }));

        if (titlePromise) {
          void titlePromise
            .then((title) => {
              dataStream.write({ type: "data-chat-title", data: title });
              void updateChatTitleById(ctx.supabase, { chatId: id, title });
            })
            .catch(() => {
              /* non-fatal */
            });
        }

        void Promise.resolve(result.totalUsage)
          .then((usage) => {
            void updateChatLastContextById(ctx.supabase, {
              chatId: id,
              context: usage as unknown as Json,
            });
          })
          .catch(() => {
            /* non-fatal */
          });
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finishedMessages }) => {
        if (isToolApprovalFlow) {
          for (const finishedMsg of finishedMessages) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              await updateMessage(ctx.supabase, {
                id: finishedMsg.id,
                parts: finishedMsg.parts,
              });
            } else {
              await saveMessages(ctx.supabase, {
                messages: [
                  {
                    id: finishedMsg.id,
                    role: finishedMsg.role,
                    parts: finishedMsg.parts,
                    createdAt: new Date(),
                    attachments: [],
                    chatId: id,
                  },
                ],
              });
            }
          }
        } else if (finishedMessages.length > 0) {
          await saveMessages(ctx.supabase, {
            messages: finishedMessages.map((currentMessage) => ({
              id: currentMessage.id,
              role: currentMessage.role,
              parts: currentMessage.parts,
              createdAt: new Date(),
              attachments: [],
              chatId: id,
            })),
          });
        }

        await persistSkillState(
          ctx.supabase,
          id,
          chatSettings,
          priorSkillState,
          composed.skillSlug,
        );
      },
      onError: () => "Oops, an error occurred!",
    });

    return createUIMessageStreamResponse({ stream });
  },

  "GET /history": async (req, ctx) => {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      Math.max(Number.parseInt(searchParams.get("limit") ?? "10", 10), 1),
      50,
    );
    const startingAfter = searchParams.get("starting_after");
    const endingBefore = searchParams.get("ending_before");

    if (startingAfter && endingBefore) {
      return new ChatbotError(
        "bad_request:api",
        "Only one of starting_after or ending_before can be provided.",
      ).toResponse();
    }

    const chats = await getChatsByUserId(ctx.supabase, {
      id: ctx.user.id,
      limit,
      startingAfter,
      endingBefore,
    });

    return Response.json(chats);
  },

  "GET /messages": async (req, ctx) => {
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get("chatId");
    if (!chatId) return json(400, { error: "chatId required" });

    const chat = await getChatById(ctx.supabase, { id: chatId });
    if (!chat) {
      return Response.json({
        messages: [],
        visibility: "private",
        userId: null,
        isReadonly: false,
      });
    }

    const messages = await getMessagesByChatId(ctx.supabase, { id: chatId });
    return Response.json({
      messages: convertToUIMessages(messages),
      visibility: chat.visibility,
      userId: chat.userId,
      isReadonly: false,
    });
  },

  // Deletes a message and everything after it in its thread (message edits).
  "DELETE /messages": async (req, ctx) => {
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("messageId");
    if (!messageId) {
      return new ChatbotError(
        "bad_request:api",
        "Parameter messageId is required.",
      ).toResponse();
    }

    const [message] = await getMessageById(ctx.supabase, { id: messageId });
    if (!message) {
      return new ChatbotError("not_found:chat").toResponse();
    }

    await deleteMessagesByChatIdAfterTimestamp(ctx.supabase, {
      chatId: message.chatId,
      timestamp: message.createdAt,
    });

    return Response.json({ ok: true });
  },

  "DELETE /thread": async (req, ctx) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return new ChatbotError("bad_request:api").toResponse();

    const deleted = await deleteChatById(ctx.supabase, { id });
    return Response.json(deleted ?? { ok: true });
  },

  "GET /document": async (req, ctx) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return new ChatbotError(
        "bad_request:api",
        "Parameter id is missing",
      ).toResponse();
    }

    const documents = await getDocumentsById(ctx.supabase, { id });
    if (documents.length === 0) {
      return new ChatbotError("not_found:document").toResponse();
    }
    return Response.json(documents);
  },

  "POST /document": async (req, ctx) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return new ChatbotError(
        "bad_request:api",
        "Parameter id is required.",
      ).toResponse();
    }

    const bodySchema = z.object({
      content: z.string(),
      title: z.string(),
      kind: z.enum(["text", "code", "image", "sheet"]),
      isManualEdit: z.boolean().optional(),
    });
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (parsed.success === false) {
      return new ChatbotError(
        "bad_request:api",
        "Invalid request body.",
      ).toResponse();
    }
    const { content, title, kind, isManualEdit } = parsed.data;

    const documents = await getDocumentsById(ctx.supabase, { id });

    if (isManualEdit && documents.length > 0) {
      const result = await updateDocumentContent(ctx.supabase, {
        id,
        content,
      });
      return Response.json(result);
    }

    const document = await saveDocument(ctx.supabase, {
      id,
      content,
      title,
      kind,
      userId: ctx.user.id,
    });

    return Response.json(document);
  },

  "DELETE /document": async (req, ctx) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const timestamp = searchParams.get("timestamp");
    if (!id || !timestamp) {
      return new ChatbotError(
        "bad_request:api",
        "Parameters id and timestamp are required.",
      ).toResponse();
    }

    const parsedTimestamp = new Date(timestamp);
    if (Number.isNaN(parsedTimestamp.getTime())) {
      return new ChatbotError(
        "bad_request:api",
        "Invalid timestamp.",
      ).toResponse();
    }

    const documentsDeleted = await deleteDocumentsByIdAfterTimestamp(
      ctx.supabase,
      { id, timestamp: parsedTimestamp },
    );

    return Response.json(documentsDeleted);
  },

  "GET /suggestions": async (req, ctx) => {
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");
    if (!documentId) {
      return new ChatbotError(
        "bad_request:api",
        "Parameter documentId is required.",
      ).toResponse();
    }

    const suggestions = await getSuggestionsByDocumentId(ctx.supabase, {
      documentId,
    });
    return Response.json(suggestions);
  },

  "GET /vote": async (req, ctx) => {
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get("chatId");
    if (!chatId) {
      return new ChatbotError(
        "bad_request:api",
        "Parameter chatId is required.",
      ).toResponse();
    }

    const votes = await getVotesByChatId(ctx.supabase, { id: chatId });
    return Response.json(votes);
  },

  "PATCH /vote": async (req, ctx) => {
    const voteSchema = z.object({
      chatId: z.string(),
      messageId: z.string(),
      type: z.enum(["up", "down"]),
    });
    const parsed = voteSchema.safeParse(await req.json().catch(() => null));
    if (parsed.success === false) {
      return new ChatbotError(
        "bad_request:api",
        "Parameters chatId, messageId, and type are required.",
      ).toResponse();
    }

    await voteMessage(ctx.supabase, parsed.data);
    return new Response("Message voted", { status: 200 });
  },

  "POST /files/upload": async (req, ctx) => {
    // Cast: react-native's global FormData type (pulled in by the native
    // entry's tsconfig) lacks .get(); at runtime this is the web FormData.
    const formData = (await req.formData().catch(() => null)) as {
      get(name: string): unknown;
    } | null;
    const file = formData?.get("file");
    if (!(file instanceof Blob)) {
      return json(400, { error: "No file uploaded" });
    }
    if (file.size > 5 * 1024 * 1024) {
      return json(400, { error: "File size should be less than 5MB" });
    }
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      return json(400, { error: "File type should be JPEG or PNG" });
    }

    const originalName = file instanceof File ? file.name : "upload";
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${ctx.user.id}/${generateUUID()}-${safeName}`;

    const upload = await ctx.supabase.storage
      .from("chat-uploads")
      .upload(path, await file.arrayBuffer(), { contentType: file.type });
    if (upload.error) {
      return json(500, { error: "Upload failed" });
    }

    // Signed URL (24h): long enough for the gateway to fetch image parts and
    // for the attachment preview; messages persist the URL as sent.
    const signed = await ctx.supabase.storage
      .from("chat-uploads")
      .createSignedUrl(path, 60 * 60 * 24);
    if (signed.error || !signed.data.signedUrl) {
      return json(500, { error: "Upload failed" });
    }

    return Response.json({
      url: signed.data.signedUrl,
      pathname: path,
      contentType: file.type,
    });
  },

  "GET /models": () => {
    // The curated set is all tool + vision capable (Anthropic via gateway).
    const capabilities = Object.fromEntries(
      chatModels.map((m) => [
        m.id,
        { tools: true, vision: true, reasoning: false },
      ]),
    );
    return Response.json(
      { capabilities, models: chatModels, defaultModel: DEFAULT_AI_MODEL },
      { headers: { "Cache-Control": "private, max-age=3600" } },
    );
  },

  // Lightweight client config (does the input show the mic button?).
  "GET /config": async (_req, ctx) => {
    const chatSettings = await getExtensionSettings<ChatSettings>(
      await ctx.getPayload(),
      settings,
    );
    return Response.json({
      transcriptionEnabled: chatSettings.transcriptionEnabled,
    });
  },

  // Voice input: multipart audio → text via the configured transcription model.
  "POST /transcribe": async (req, ctx) => {
    if (!process.env.OPENAI_API_KEY) {
      return json(503, { error: "Transcription is not configured" });
    }
    const chatSettings = await getExtensionSettings<ChatSettings>(
      await ctx.getPayload(),
      settings,
    );
    if (!chatSettings.transcriptionEnabled) {
      return json(403, { error: "Transcription is disabled" });
    }

    const formData = (await req.formData().catch(() => null)) as {
      get(name: string): unknown;
    } | null;
    const audio = formData?.get("audio");
    if (!(audio instanceof Blob)) {
      return json(400, { error: "No audio uploaded" });
    }
    if (audio.size > chatSettings.maxAudioMB * 1024 * 1024) {
      return json(400, {
        error: `Audio exceeds ${chatSettings.maxAudioMB}MB`,
      });
    }

    try {
      const text = await transcribeAudio(
        new Uint8Array(await audio.arrayBuffer()),
        chatSettings.transcriptionModel,
      );
      return Response.json({ text });
    } catch (e) {
      return json(500, {
        error: e instanceof Error ? e.message : "Transcription failed",
      });
    }
  },
};
