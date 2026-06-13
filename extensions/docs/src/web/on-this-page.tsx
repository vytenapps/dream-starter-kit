"use client";

import { useEffect, useState } from "react";

import { cn } from "@acme/ui";

interface Heading {
  id: string;
  text: string;
  level: number;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * "On this page" TOC with scroll-spy. Scans the rendered article for h2/h3
 * (the Lexical renderer emits them without ids, so we assign ids here) and
 * highlights the heading currently in view.
 */
export function OnThisPage() {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("article h2, article h3"),
    );
    const found = nodes.map((el) => {
      const text = el.textContent ?? "";
      if (!el.id) el.id = slugify(text);
      return { id: el.id, text, level: el.tagName === "H3" ? 3 : 2 };
    });
    setHeadings(found);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "0px 0px -70% 0px", threshold: 1 },
    );
    for (const el of nodes) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (headings.length === 0) return null;

  return (
    <div>
      <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
        On this page
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {headings.map((h) => (
          <li key={h.id} style={{ paddingLeft: h.level === 3 ? 12 : 0 }}>
            <a
              className={cn(
                "hover:text-foreground block transition-colors",
                active === h.id
                  ? "text-foreground font-medium"
                  : "text-muted-foreground",
              )}
              href={`#${h.id}`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
