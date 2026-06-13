import "server-only";

// KIT ADAPTATION (see VENDOR.md): upstream used Drizzle against a module-level
// Postgres pool. Here every query runs through the caller's RLS-scoped
// Supabase client (passed in by the extension's server routes), so ownership
// checks are enforced by Postgres policies, not app code. Row shapes are
// mapped snake_case → camelCase to keep the vendored components unchanged.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@acme/api";

import type { ArtifactKind } from "../../components/chat/artifact";
import type { Chat, DBMessage, Document, Suggestion, Vote } from "./schema";
import { ChatbotError } from "../errors";

export type Db = SupabaseClient<Database>;

type ThreadRow = Database["public"]["Tables"]["ext_chat_threads"]["Row"];
type MessageRow = Database["public"]["Tables"]["ext_chat_messages"]["Row"];
type DocumentRow = Database["public"]["Tables"]["ext_chat_documents"]["Row"];
type SuggestionRow =
  Database["public"]["Tables"]["ext_chat_suggestions"]["Row"];
type VoteRow = Database["public"]["Tables"]["ext_chat_votes"]["Row"];

const toChat = (row: ThreadRow): Chat => ({
  id: row.id,
  createdAt: new Date(row.created_at),
  title: row.title ?? "New chat",
  // user_id is nullable since channel threads can be unlinked; web queries
  // only ever read the caller's own (non-null) threads.
  userId: row.user_id ?? "",
  visibility: (row.visibility as Chat["visibility"]) ?? "private",
});

const toMessage = (row: MessageRow): DBMessage => ({
  id: row.id,
  chatId: row.thread_id,
  role: row.role,
  parts: row.parts ?? [{ type: "text", text: row.content }],
  attachments: row.attachments ?? [],
  createdAt: new Date(row.created_at),
});

const toDocument = (row: DocumentRow): Document => ({
  id: row.id,
  createdAt: new Date(row.created_at),
  title: row.title,
  content: row.content,
  kind: row.kind as Document["kind"],
  userId: row.user_id,
});

const toSuggestion = (row: SuggestionRow): Suggestion => ({
  id: row.id,
  documentId: row.document_id,
  documentCreatedAt: new Date(row.document_created_at),
  originalText: row.original_text,
  suggestedText: row.suggested_text,
  description: row.description,
  isResolved: row.is_resolved,
  userId: row.user_id,
  createdAt: new Date(row.created_at),
});

const toVote = (row: VoteRow): Vote => ({
  chatId: row.thread_id,
  messageId: row.message_id,
  isUpvoted: row.is_upvoted,
});

/** Plain-text projection of UIMessage parts — keeps the native screens (which
 * render `content`) working alongside the structured `parts` column. */
export function textFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) {
    return "";
  }
  return parts
    .filter(
      (p): p is { type: "text"; text: string } =>
        typeof p === "object" &&
        p !== null &&
        (p as { type?: string }).type === "text" &&
        typeof (p as { text?: unknown }).text === "string",
    )
    .map((p) => p.text)
    .join("");
}

export async function saveChat(
  db: Db,
  {
    id,
    userId,
    title,
    visibility,
  }: {
    id: string;
    userId: string;
    title: string;
    visibility: Chat["visibility"];
  },
) {
  const { error } = await db
    .from("ext_chat_threads")
    .insert({ id, user_id: userId, title, visibility });
  if (error) {
    throw new ChatbotError("bad_request:database", "Failed to save chat");
  }
}

export async function deleteChatById(db: Db, { id }: { id: string }) {
  const { data, error } = await db
    .from("ext_chat_threads")
    .delete()
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete chat by id",
    );
  }
  return data ? toChat(data) : null;
}

export async function getChatsByUserId(
  db: Db,
  {
    id,
    limit,
    startingAfter,
    endingBefore,
  }: {
    id: string;
    limit: number;
    startingAfter: string | null;
    endingBefore: string | null;
  },
) {
  const cursorId = startingAfter ?? endingBefore;
  let query = db
    .from("ext_chat_threads")
    .select("*")
    .eq("user_id", id)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (cursorId) {
    const { data: cursor, error: cursorError } = await db
      .from("ext_chat_threads")
      .select("created_at")
      .eq("id", cursorId)
      .maybeSingle();
    if (cursorError || !cursor) {
      throw new ChatbotError(
        "not_found:database",
        `Chat with id ${cursorId} not found`,
      );
    }
    query = startingAfter
      ? query.gt("created_at", cursor.created_at)
      : query.lt("created_at", cursor.created_at);
  }

  const { data, error } = await query;
  if (error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get chats by user id",
    );
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  return {
    chats: (hasMore ? rows.slice(0, limit) : rows).map(toChat),
    hasMore,
  };
}

export async function getChatById(db: Db, { id }: { id: string }) {
  const { data, error } = await db
    .from("ext_chat_threads")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new ChatbotError("bad_request:database", "Failed to get chat by id");
  }
  return data ? toChat(data) : null;
}

export async function saveMessages(
  db: Db,
  { messages }: { messages: DBMessage[] },
) {
  const { error } = await db.from("ext_chat_messages").insert(
    messages.map((m) => ({
      id: m.id,
      thread_id: m.chatId,
      role: m.role,
      content: textFromParts(m.parts),
      parts: m.parts as Json,
      attachments: (m.attachments ?? []) as Json,
      created_at: m.createdAt.toISOString(),
    })),
  );
  if (error) {
    throw new ChatbotError("bad_request:database", "Failed to save messages");
  }
}

export async function updateMessage(
  db: Db,
  { id, parts }: { id: string; parts: DBMessage["parts"] },
) {
  const { error } = await db
    .from("ext_chat_messages")
    .update({ parts: parts as Json, content: textFromParts(parts) })
    .eq("id", id);
  if (error) {
    throw new ChatbotError("bad_request:database", "Failed to update message");
  }
}

export async function getMessagesByChatId(db: Db, { id }: { id: string }) {
  const { data, error } = await db
    .from("ext_chat_messages")
    .select("*")
    .eq("thread_id", id)
    .order("created_at", { ascending: true });
  if (error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get messages by chat id",
    );
  }
  return (data ?? []).map(toMessage);
}

export async function getMessageById(db: Db, { id }: { id: string }) {
  const { data, error } = await db
    .from("ext_chat_messages")
    .select("*")
    .eq("id", id);
  if (error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message by id",
    );
  }
  return (data ?? []).map(toMessage);
}

export async function deleteMessagesByChatIdAfterTimestamp(
  db: Db,
  { chatId, timestamp }: { chatId: string; timestamp: Date },
) {
  const { error } = await db
    .from("ext_chat_messages")
    .delete()
    .eq("thread_id", chatId)
    .gte("created_at", timestamp.toISOString());
  if (error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp",
    );
  }
}

export async function voteMessage(
  db: Db,
  {
    chatId,
    messageId,
    type,
  }: {
    chatId: string;
    messageId: string;
    type: "up" | "down";
  },
) {
  const { error } = await db.from("ext_chat_votes").upsert({
    thread_id: chatId,
    message_id: messageId,
    is_upvoted: type === "up",
  });
  if (error) {
    throw new ChatbotError("bad_request:database", "Failed to vote message");
  }
}

export async function getVotesByChatId(db: Db, { id }: { id: string }) {
  const { data, error } = await db
    .from("ext_chat_votes")
    .select("*")
    .eq("thread_id", id);
  if (error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get votes by chat id",
    );
  }
  return (data ?? []).map(toVote);
}

export async function saveDocument(
  db: Db,
  {
    id,
    title,
    kind,
    content,
    userId,
  }: {
    id: string;
    title: string;
    kind: ArtifactKind;
    content: string;
    userId: string;
  },
) {
  const { data, error } = await db
    .from("ext_chat_documents")
    .insert({ id, title, kind, content, user_id: userId })
    .select();
  if (error) {
    throw new ChatbotError("bad_request:database", "Failed to save document");
  }
  return (data ?? []).map(toDocument);
}

export async function getDocumentsById(db: Db, { id }: { id: string }) {
  const { data, error } = await db
    .from("ext_chat_documents")
    .select("*")
    .eq("id", id)
    .order("created_at", { ascending: true });
  if (error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get documents by id",
    );
  }
  return (data ?? []).map(toDocument);
}

export async function getDocumentById(db: Db, { id }: { id: string }) {
  const { data, error } = await db
    .from("ext_chat_documents")
    .select("*")
    .eq("id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get document by id",
    );
  }
  return data ? toDocument(data) : undefined;
}

export async function deleteDocumentsByIdAfterTimestamp(
  db: Db,
  { id, timestamp }: { id: string; timestamp: Date },
) {
  // Suggestions cascade via the composite FK when their version rows go.
  const { data, error } = await db
    .from("ext_chat_documents")
    .delete()
    .eq("id", id)
    .gt("created_at", timestamp.toISOString())
    .select();
  if (error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete documents by id after timestamp",
    );
  }
  return (data ?? []).map(toDocument);
}

export async function saveSuggestions(
  db: Db,
  { suggestions }: { suggestions: Suggestion[] },
) {
  const { error } = await db.from("ext_chat_suggestions").insert(
    suggestions.map((s) => ({
      id: s.id,
      document_id: s.documentId,
      document_created_at: s.documentCreatedAt.toISOString(),
      original_text: s.originalText,
      suggested_text: s.suggestedText,
      description: s.description,
      is_resolved: s.isResolved,
      user_id: s.userId,
      created_at: s.createdAt.toISOString(),
    })),
  );
  if (error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to save suggestions",
    );
  }
}

export async function getSuggestionsByDocumentId(
  db: Db,
  { documentId }: { documentId: string },
) {
  const { data, error } = await db
    .from("ext_chat_suggestions")
    .select("*")
    .eq("document_id", documentId);
  if (error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get suggestions by document id",
    );
  }
  return (data ?? []).map(toSuggestion);
}

export async function updateChatTitleById(
  db: Db,
  { chatId, title }: { chatId: string; title: string },
) {
  await db.from("ext_chat_threads").update({ title }).eq("id", chatId);
}

export async function updateChatLastContextById(
  db: Db,
  { chatId, context }: { chatId: string; context: Json },
) {
  await db
    .from("ext_chat_threads")
    .update({ last_context: context })
    .eq("id", chatId);
}

export async function updateDocumentContent(
  db: Db,
  { id, content }: { id: string; content: string },
) {
  const { data: latest, error: latestError } = await db
    .from("ext_chat_documents")
    .select("created_at")
    .eq("id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError || !latest) {
    throw new ChatbotError("not_found:database", "Document not found");
  }

  const { data, error } = await db
    .from("ext_chat_documents")
    .update({ content })
    .eq("id", id)
    .eq("created_at", latest.created_at)
    .select();
  if (error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update document content",
    );
  }
  return (data ?? []).map((row) => row.id);
}
