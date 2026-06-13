import Link from "next/link";

import { cn } from "@acme/ui";

import type { DocNavGroup } from "./data";
import { DocsTopBar } from "../web/docs-top-bar";
import { OnThisPage } from "../web/on-this-page";

/**
 * The cursor.com/docs-style three-column shell (shadcn-only): sticky left
 * sidebar (grouped nav), center article, sticky right "On this page" TOC.
 * The top bar (⌘K search + Ask AI) and the TOC are client islands.
 */
export function DocsShell({
  nav,
  activeSlug,
  children,
  showToc = true,
}: {
  nav: DocNavGroup[];
  activeSlug?: string;
  children: React.ReactNode;
  showToc?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4">
      <DocsTopBar activeSlug={activeSlug} nav={nav} />
      <div className="flex gap-8">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 overflow-y-auto py-8 md:block">
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
                      >
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 py-8">{children}</main>

        {showToc ? (
          <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-52 shrink-0 overflow-y-auto py-8 xl:block">
            <OnThisPage />
          </aside>
        ) : null}
      </div>
    </div>
  );
}
