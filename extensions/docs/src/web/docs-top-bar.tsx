"use client";

import { useEffect, useState } from "react";
import { SearchIcon, SparklesIcon } from "lucide-react";

import { Button } from "@acme/ui/button";

import { AskAiPanel } from "./ask-ai-panel";
import { openAskAi } from "./ask-bus";
import { DocsSearch } from "./docs-search";

/**
 * Sticky docs top bar (shadcn-only): a ⌘K search trigger and an Ask-AI button.
 * Mounts the single DocsSearch dialog and AskAiPanel sheet; both are also
 * openable from elsewhere (⌘K shortcut, Explain-more, selection toolbar).
 */
export function DocsTopBar() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="bg-background/80 sticky top-0 z-40 flex h-14 items-center gap-2 border-b backdrop-blur">
      <button
        className="text-muted-foreground hover:border-foreground/30 inline-flex h-8 w-full max-w-xs items-center gap-2 rounded-md border px-2.5 text-sm transition-colors"
        onClick={() => setSearchOpen(true)}
        type="button"
      >
        <SearchIcon className="size-4" />
        <span>Search docs…</span>
        <kbd className="bg-muted ml-auto rounded border px-1.5 text-xs">⌘K</kbd>
      </button>

      <Button
        className="ml-auto"
        onClick={() => openAskAi()}
        size="sm"
        variant="outline"
      >
        <SparklesIcon className="size-4" />
        Ask AI
      </Button>

      <DocsSearch onOpenChange={setSearchOpen} open={searchOpen} />
      <AskAiPanel />
    </div>
  );
}
