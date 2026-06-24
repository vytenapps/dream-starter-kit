import type { Payload, TypedUser, Where } from "payload";

/**
 * The per-request context every MCP tool runs in. `payload` is the injected
 * Local API instance; `user` is the resolved staff `cms.users` row. All
 * data-access helpers below run with `overrideAccess: false` and pass `user`,
 * so Payload's role-based access control (payload/access) is enforced exactly
 * as it is in /admin — the MCP can never do what the admin couldn't.
 */
export interface McpToolContext {
  payload: Payload;
  user: TypedUser;
  /** Public app origin, for building absolute URLs (ChatGPT search/fetch). */
  origin: string;
  /**
   * Injected by the host (the /mcp route handler) so this framework-agnostic
   * package never imports the server-only image renderer (`ai` + `sharp`).
   * Renders ONE image from a prompt, stores it as a Media doc as the current
   * staff user (overrideAccess: false), and returns its id + public URL. When
   * unset (e.g. in unit tests), the `generate_media` tool is not registered.
   */
  generateMedia?: (args: {
    prompt: string;
    format?: "hero" | "og" | "square";
    alt?: string;
  }) => Promise<{ id: number | string; url: string | null; alt: string }>;
}

/** Roles allowed to use the MCP at all — mirrors /admin's canAccessAdmin gate. */
const MCP_STAFF_ROLES = ["admin", "editor", "author"];

/**
 * Resolve the Payload user context for a verified Supabase user id. Returns
 * null if there is no `cms.users` row, it is trashed, or it is not staff — the
 * caller turns null into a 403. This is a SYSTEM lookup (`overrideAccess: true`):
 * we are identifying the caller, not acting as them yet.
 */
export async function resolveStaffPayloadUser(
  payload: Payload,
  supabaseUserId: string,
): Promise<TypedUser | null> {
  const { docs } = await payload.find({
    collection: "users",
    where: { supabaseUserId: { equals: supabaseUserId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const doc = docs[0] as
    | { id: number | string; roles?: string[]; deletedAt?: string | null }
    | undefined;
  if (!doc) return null;
  if (doc.deletedAt) return null; // trashed staff are locked out
  const roles = doc.roles ?? [];
  if (!roles.some((r) => MCP_STAFF_ROLES.includes(r))) return null;
  return { ...doc, collection: "users" } as unknown as TypedUser;
}

// --- Access-enforced data helpers ---------------------------------------------
// `collection` is a validated allowlist string. In this package's type context
// Payload's `CollectionSlug` resolves to `string` (no app config augmentation),
// so docs come back as generic records — which is exactly what the tools want
// (they serialize to JSON), so we avoid Payload's per-slug generics here.

export type Doc = Record<string, unknown>;

export interface FindResult {
  docs: Doc[];
  totalDocs: number;
  page: number;
  totalPages: number;
}

export async function findDocs(
  ctx: McpToolContext,
  collection: string,
  opts: {
    where?: Where;
    limit?: number;
    page?: number;
    sort?: string;
    depth?: number;
  },
): Promise<FindResult> {
  const res = await ctx.payload.find({
    collection,
    where: opts.where,
    limit: opts.limit ?? 20,
    page: opts.page ?? 1,
    sort: opts.sort,
    depth: opts.depth ?? 0,
    overrideAccess: false,
    user: ctx.user,
  });
  return {
    docs: res.docs,
    totalDocs: res.totalDocs,
    page: res.page ?? 1,
    totalPages: res.totalPages,
  };
}

export async function findDoc(
  ctx: McpToolContext,
  collection: string,
  id: string,
  depth = 1,
): Promise<Doc | null> {
  try {
    const doc = await ctx.payload.findByID({
      collection,
      id,
      depth,
      overrideAccess: false,
      user: ctx.user,
    });
    return doc;
  } catch {
    return null;
  }
}

export async function createDoc(
  ctx: McpToolContext,
  collection: string,
  data: Doc,
): Promise<Doc> {
  const doc = await ctx.payload.create({
    collection,
    data: data as never,
    overrideAccess: false,
    user: ctx.user,
  });
  return doc;
}

export async function updateDoc(
  ctx: McpToolContext,
  collection: string,
  id: string,
  data: Doc,
): Promise<Doc> {
  const doc = await ctx.payload.update({
    collection,
    id,
    data: data as never,
    overrideAccess: false,
    user: ctx.user,
  });
  return doc;
}

export async function deleteDoc(
  ctx: McpToolContext,
  collection: string,
  id: string,
): Promise<Doc> {
  const doc = await ctx.payload.delete({
    collection,
    id,
    overrideAccess: false,
    user: ctx.user,
  });
  return doc;
}

/**
 * The sanitized field list for a collection (from the running Payload config),
 * used by write-verification to know which keys are real, writable data fields.
 * Returns an empty array if the collection isn't registered.
 */
export function getCollectionFields(
  ctx: McpToolContext,
  collection: string,
): unknown[] {
  const collections = (
    ctx.payload as unknown as {
      collections?: Record<string, { config?: { fields?: unknown[] } }>;
    }
  ).collections;
  return collections?.[collection]?.config?.fields ?? [];
}
