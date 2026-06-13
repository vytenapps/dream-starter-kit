import "server-only";

import { convertToModelMessages, streamText } from "ai";
import { z } from "zod/v4";

import type {
  ExtPublicRouteContext,
  ExtPublicRouteTable,
  ExtRouteContext,
  ExtRouteTable,
} from "@acme/ext-kit/server";
import { DEFAULT_AI_MODEL, isAiGatewayConfigured } from "@acme/config";

import type { DocsSettings } from "../payload/settings";
import { lexicalToPlainText } from "./lexical-text";

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status });

interface DocRow {
  id: number | string;
  title: string;
  slug: string;
  excerpt?: string | null;
  body?: unknown;
  category?: string | null;
}

/** Keyword scorer over published docs (title/excerpt/body). The Phase-2 RAG
 * work swaps this for embeddings; the route contract stays. */
function scoreDocs(query: string, docs: DocRow[], k: number) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return docs
    .map((d) => {
      const hay =
        `${d.title}\n${d.excerpt ?? ""}\n${lexicalToPlainText(d.body)}`.toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (d.title.toLowerCase().includes(t)) score += 3;
        if (hay.includes(t)) score += 1;
      }
      return { doc: d, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((r) => r.doc);
}

async function fetchPublishedDocs(
  ctx: ExtRouteContext | ExtPublicRouteContext,
): Promise<DocRow[]> {
  const payload = await ctx.getPayload();
  const res = await payload.find({
    collection: "ext-docs-pages",
    where: { _status: { equals: "published" } },
    limit: 500,
    depth: 0,
  });
  return res.docs as unknown as DocRow[];
}

/** Public: full-text-ish search for the ⌘K palette (no AI, no auth). */
export const publicRoutes: ExtPublicRouteTable = {
  "GET /search": async (req, ctx) => {
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (!q) return Response.json({ results: [] });
    const docs = await fetchPublishedDocs(ctx);
    const results = scoreDocs(q, docs, 8).map((d) => ({
      title: d.title,
      slug: d.slug,
      excerpt: d.excerpt ?? null,
      category: d.category ?? null,
    }));
    return Response.json({ results });
  },
};

const uiMessageSchema = z.looseObject({
  id: z.string().optional(),
  role: z.string(),
  parts: z
    .array(z.looseObject({ type: z.string(), text: z.string().optional() }))
    .optional(),
});
const askBodySchema = z.object({
  messages: z.array(uiMessageSchema),
  currentSlug: z.string().optional(),
});

/** Authed (golden rule #6): grounded Q&A over the docs. Retrieves top docs by
 * keyword (+ the page in view) and streams a cited answer. */
export const routes: ExtRouteTable = {
  "POST /ask": async (req, ctx) => {
    if (!isAiGatewayConfigured()) {
      return json(503, { error: "AI is not configured" });
    }
    const parsed = askBodySchema.safeParse(await req.json().catch(() => null));
    if (parsed.success === false) {
      return json(400, { error: "Invalid request" });
    }
    const { messages, currentSlug } = parsed.data;

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const query = (lastUser?.parts ?? [])
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join(" ");

    const docs = await fetchPublishedDocs(ctx);
    const top = scoreDocs(query, docs, 4);
    if (currentSlug) {
      const cur = docs.find((d) => d.slug === currentSlug);
      if (cur && !top.some((d) => d.slug === currentSlug)) top.unshift(cur);
    }

    const context = top
      .map(
        (d) =>
          `<doc slug="${d.slug}" title="${d.title}">\n${lexicalToPlainText(d.body).slice(0, 4000)}\n</doc>`,
      )
      .join("\n\n");

    const system = `You answer questions about this product using ONLY the documentation excerpts below. If the answer isn't in them, say so and suggest where to look. Be concise. Cite the doc slugs you used at the end as "Sources: <slug>, <slug>".

${context || "(no matching docs found)"}`;

    const result = streamText({
      model: DEFAULT_AI_MODEL,
      system,
      messages: await convertToModelMessages(
        messages as Parameters<typeof convertToModelMessages>[0],
      ),
    });
    return result.toUIMessageStreamResponse();
  },

  // Staff-only manual trigger (CI / webhook) for the GitHub sync.
  "POST /sync": async (_req, ctx) => {
    const { data: profile } = await ctx.supabase
      .from("profiles")
      .select("is_staff")
      .eq("id", ctx.user.id)
      .single();
    if (!profile?.is_staff) return json(403, { error: "Staff only" });

    const payload = await ctx.getPayload();
    const { getExtensionSettings } = await import("@acme/ext-kit/payload");
    const { settings } = await import("../payload/settings");
    const { syncDocsFromGitHub } = await import("./sync");
    const docsSettings = await getExtensionSettings<DocsSettings>(
      payload,
      settings,
    );
    try {
      const r = await syncDocsFromGitHub(payload, docsSettings);
      return Response.json({ ok: true, ...r });
    } catch (e) {
      return json(500, {
        error: e instanceof Error ? e.message : "Sync failed",
      });
    }
  },
};
