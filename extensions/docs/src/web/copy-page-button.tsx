"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { Button } from "@acme/ui/button";

/** Copies the rendered article's text (a markdown-ish plain version). */
export function CopyPageButton() {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      onClick={() => {
        const article = document.querySelector("article");
        const text = article?.innerText ?? "";
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      size="sm"
      variant="outline"
    >
      {copied ? (
        <CheckIcon className="size-3.5" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
      Copy page
    </Button>
  );
}
