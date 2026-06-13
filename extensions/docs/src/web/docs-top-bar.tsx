"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MenuIcon, SearchIcon, SparklesIcon } from "lucide-react";
import { Dialog } from "radix-ui";

import { cn } from "@acme/ui";
import { Button } from "@acme/ui/button";

import { AskAiPanel } from "./ask-ai-panel";
import { openAskAi } from "./ask-bus";
import { DocsSearch } from "./docs-search";

export interface DocsNavItem {
  title: string;
  slug: string;
}
export interface DocsNavGroup {
  category: string;
  items: DocsNavItem[];
}

/**
 * Sticky docs top bar (shadcn-only): a mobile nav-drawer trigger (md:hidden,
 * matching cursor.com/docs where the sidebar collapses to a hamburger), a ⌘K
 * search trigger, and an Ask-AI button. Mounts the single DocsSearch dialog +
 * AskAiPanel sheet (both also openable from elsewhere).
 */
export function DocsTopBar({
  nav = [],
  activeSlug,
}: {
  nav?: DocsNavGroup[];
  activeSlug?: string;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

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
      {/* Mobile-only nav drawer trigger (the sidebar is hidden < md). */}
      <Dialog.Root onOpenChange={setNavOpen} open={navOpen}>
        <Dialog.Trigger asChild>
          <Button
            aria-label="Open navigation"
            className="md:hidden"
            size="icon"
            variant="ghost"
          >
            <MenuIcon className="size-4" />
          </Button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40 md:hidden" />
          <Dialog.Content className="bg-background data-[state=open]:animate-in data-[state=open]:slide-in-from-left fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto border-r p-4 md:hidden">
            <Dialog.Title className="mb-3 text-sm font-semibold">
              Documentation
            </Dialog.Title>
            <nav className="flex flex-col gap-6">
              {nav.map((group) => (
                <div key={group.category}>
                  <div className="text-muted-foreground mb-1.5 px-2 text-xs font-semibold tracking-wider uppercase">
                    {group.category}
                  </div>
                  <ul className="flex flex-col">
                    {group.items.map((item) => (
                      <li key={item.slug}>
                        <Link
                          className={cn(
                            "block rounded-md px-2 py-1.5 text-sm transition-colors",
                            item.slug === activeSlug
                              ? "bg-accent text-accent-foreground font-medium"
                              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                          )}
                          href={`/docs/${item.slug}`}
                          onClick={() => setNavOpen(false)}
                        >
                          {item.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <button
        className="text-muted-foreground hover:border-foreground/30 inline-flex h-8 w-full max-w-xs items-center gap-2 rounded-md border px-2.5 text-sm transition-colors"
        onClick={() => setSearchOpen(true)}
        type="button"
      >
        <SearchIcon className="size-4" />
        <span>Search docs…</span>
        <kbd className="bg-muted ml-auto rounded border px-1.5 text-xs max-sm:hidden">
          ⌘K
        </kbd>
      </button>

      <Button
        className="ml-auto shrink-0"
        onClick={() => openAskAi()}
        size="sm"
        variant="outline"
      >
        <SparklesIcon className="size-4" />
        <span className="max-sm:sr-only">Ask AI</span>
      </Button>

      <DocsSearch onOpenChange={setSearchOpen} open={searchOpen} />
      <AskAiPanel />
    </div>
  );
}
