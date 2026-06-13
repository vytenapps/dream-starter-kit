import "server-only";

import type { BasePayload } from "payload";
import {
  convertMarkdownToLexical,
  editorConfigFactory,
} from "@payloadcms/richtext-lexical";
import matter from "gray-matter";

import type { DocsSettings } from "../payload/settings";

interface GitTreeEntry {
  path: string;
  type: string;
  sha: string;
}

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  unpublished: number;
}

const slugify = (val: string): string =>
  val
    .toLowerCase()
    .trim()
    .replace(/\.mdx?$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const titleFromMarkdown = (md: string, fallback: string): string => {
  const heading = /^#\s+(.+)$/m.exec(md);
  return heading?.[1]?.trim() ?? fallback;
};

const ghHeaders = (): HeadersInit => {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
};

/**
 * Pull `*.md`/`*.mdx` under `githubPath` from a public repo into the
 * ext-docs-pages collection. Idempotent: a page whose stored sourceSha matches
 * the blob sha is skipped; pages that vanished upstream are unpublished (never
 * deleted); `source: manual` pages are never touched.
 */
export async function syncDocsFromGitHub(
  payload: BasePayload,
  settings: DocsSettings,
  req?: Parameters<BasePayload["update"]>[0]["req"],
): Promise<SyncResult> {
  const repo = settings.githubRepo?.trim();
  if (!repo || !/^[^/]+\/[^/]+$/.test(repo)) {
    throw new Error('githubRepo must be "owner/name".');
  }
  const branch = settings.githubBranch.trim() || "main";
  const folder = (settings.githubPath.trim() || "docs").replace(
    /^\/+|\/+$/g,
    "",
  );

  const treeRes = await fetch(
    `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`,
    { headers: ghHeaders() },
  );
  if (!treeRes.ok) {
    throw new Error(
      `GitHub tree fetch failed (${treeRes.status}). Check repo/branch are public.`,
    );
  }
  const treeJson = (await treeRes.json()) as { tree?: GitTreeEntry[] };
  const entries = (treeJson.tree ?? []).filter(
    (e) =>
      e.type === "blob" &&
      e.path.startsWith(`${folder}/`) &&
      /\.mdx?$/.test(e.path),
  );

  const editorConfig = await editorConfigFactory.default({
    config: payload.config,
  });

  const result: SyncResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    unpublished: 0,
  };
  const seenPaths = new Set<string>();

  for (const entry of entries) {
    seenPaths.add(entry.path);

    const existing = await payload.find({
      collection: "ext-docs-pages",
      where: { sourcePath: { equals: entry.path } },
      limit: 1,
      depth: 0,
      req,
    });
    const current = existing.docs[0] as
      | { id: number | string; sourceSha?: string | null }
      | undefined;

    if (current?.sourceSha === entry.sha) {
      result.skipped++;
      continue;
    }

    const rawRes = await fetch(
      `https://raw.githubusercontent.com/${repo}/${branch}/${entry.path}`,
      { headers: ghHeaders() },
    );
    if (!rawRes.ok) continue;
    const rawText = await rawRes.text();

    const { content, data } = matter(rawText);
    const fm = data as Record<string, unknown>;
    const fileName = entry.path.split("/").pop() ?? entry.path;
    const title =
      (typeof fm.title === "string" ? fm.title : undefined) ??
      titleFromMarkdown(content, slugify(fileName));
    const slug =
      (typeof fm.slug === "string" ? fm.slug : undefined) ?? slugify(fileName);
    const category = typeof fm.category === "string" ? fm.category : undefined;
    const order = typeof fm.order === "number" ? fm.order : 0;
    const excerpt =
      typeof fm.description === "string" ? fm.description : undefined;

    const body = convertMarkdownToLexical({ editorConfig, markdown: content });

    const data_ = {
      title,
      slug,
      excerpt,
      category,
      order,
      body,
      source: "github" as const,
      sourcePath: entry.path,
      sourceSha: entry.sha,
      _status: "published" as const,
    };

    if (current) {
      await payload.update({
        collection: "ext-docs-pages",
        id: current.id,
        data: data_,
        req,
      });
      result.updated++;
    } else {
      await payload.create({
        collection: "ext-docs-pages",
        data: data_,
        req,
      });
      result.created++;
    }
  }

  // Unpublish github-sourced pages that disappeared upstream.
  const ghPages = await payload.find({
    collection: "ext-docs-pages",
    where: { source: { equals: "github" } },
    limit: 1000,
    depth: 0,
    req,
  });
  for (const doc of ghPages.docs as {
    id: number | string;
    sourcePath?: string | null;
    _status?: string;
  }[]) {
    if (
      doc.sourcePath &&
      !seenPaths.has(doc.sourcePath) &&
      doc._status === "published"
    ) {
      await payload.update({
        collection: "ext-docs-pages",
        id: doc.id,
        data: { _status: "draft" },
        req,
      });
      result.unpublished++;
    }
  }

  return result;
}
