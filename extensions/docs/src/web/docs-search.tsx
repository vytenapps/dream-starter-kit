"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, SparklesIcon } from "lucide-react";
import { Dialog } from "radix-ui";

import { openAskAi } from "./ask-bus";

interface SearchResult {
  title: string;
  slug: string;
  excerpt: string | null;
  category: string | null;
}

/**
 * ⌘K search palette (shadcn-styled radix Dialog). Queries the public
 * GET /api/ext/docs/search route; offers an "Ask AI" escape hatch.
 */
export function DocsSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      void fetch(`/api/ext/docs/search?q=${encodeURIComponent(query)}`, {
        signal: ctrl.signal,
      })
        .then((r) => r.json())
        .then((d: { results?: SearchResult[] }) => setResults(d.results ?? []))
        .catch(() => undefined);
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const go = (slug: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(`/docs/${slug}`);
  };

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="bg-background data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed top-24 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border shadow-2xl">
          <Dialog.Title className="sr-only">Search docs</Dialog.Title>
          <div className="flex items-center gap-2 border-b px-3">
            <SearchIcon className="text-muted-foreground size-4" />
            <input
              autoFocus
              className="h-12 w-full bg-transparent text-sm outline-none"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documentation…"
              value={query}
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {results.length === 0 && query.trim() ? (
              <button
                className="text-muted-foreground hover:bg-accent flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm"
                onClick={() => {
                  onOpenChange(false);
                  openAskAi(query);
                }}
                type="button"
              >
                <SparklesIcon className="size-4" />
                Ask AI: “{query}”
              </button>
            ) : null}
            {results.map((r) => (
              <button
                className="hover:bg-accent flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left"
                key={r.slug}
                onClick={() => go(r.slug)}
                type="button"
              >
                <span className="text-sm font-medium">{r.title}</span>
                {r.excerpt ? (
                  <span className="text-muted-foreground line-clamp-1 text-xs">
                    {r.excerpt}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
