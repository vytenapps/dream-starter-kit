"use client";

import { useEffect, useState } from "react";
import { SparklesIcon } from "lucide-react";

import { Button } from "@acme/ui/button";

import { openAskAi } from "./ask-bus";

/**
 * "Explain more": a page-level button that seeds the Ask-AI panel, plus a
 * floating button on text selection that seeds it with the selected passage.
 */
export function ExplainMore({
  pageTitle,
  slug,
}: {
  pageTitle: string;
  slug: string;
}) {
  const [sel, setSel] = useState<{ text: string; x: number; y: number } | null>(
    null,
  );

  useEffect(() => {
    const onUp = () => {
      const s = window.getSelection();
      const text = s?.toString().trim() ?? "";
      const article = document.querySelector("article");
      if (
        text.length > 12 &&
        s &&
        article?.contains(s.anchorNode) &&
        s.rangeCount > 0
      ) {
        const rect = s.getRangeAt(0).getBoundingClientRect();
        setSel({ text, x: rect.left + rect.width / 2, y: rect.top - 8 });
      } else {
        setSel(null);
      }
    };
    document.addEventListener("mouseup", onUp);
    return () => document.removeEventListener("mouseup", onUp);
  }, []);

  return (
    <>
      <Button
        onClick={() =>
          openAskAi(
            `Explain "${pageTitle}" (docs page: ${slug}) in more detail.`,
          )
        }
        size="sm"
        variant="outline"
      >
        <SparklesIcon className="size-3.5" />
        Explain more
      </Button>

      {sel ? (
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full"
          style={{ left: sel.x, top: sel.y }}
        >
          <Button
            onClick={() => {
              openAskAi(`Explain this in more detail:\n\n"${sel.text}"`);
              setSel(null);
            }}
            size="sm"
          >
            <SparklesIcon className="size-3.5" />
            Explain
          </Button>
        </div>
      ) : null}
    </>
  );
}
