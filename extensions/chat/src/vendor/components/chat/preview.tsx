"use client";

import { useRouter } from "next/navigation";

import { suggestions } from "../../lib/constants";
import { SparklesIcon } from "./icons";

export function Preview() {
  const router = useRouter();

  const handleAction = (query?: string) => {
    const url = query ? `/?query=${encodeURIComponent(query)}` : "/";
    router.push(url);
  };

  return (
    <div className="bg-background flex h-full flex-col overflow-hidden rounded-tl-2xl">
      <div className="border-border/20 flex h-14 shrink-0 items-center gap-3 border-b px-5">
        <div className="bg-muted/60 ring-border/50 flex size-5 items-center justify-center rounded ring-1">
          <SparklesIcon size={10} />
        </div>
        <span className="text-muted-foreground text-[13px]">Chatbot</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold tracking-tight">
            What can I help with?
          </h2>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Ask a question, write code, or explore ideas.
          </p>
        </div>

        <div className="grid w-full max-w-md grid-cols-2 gap-2">
          {suggestions.map((suggestion) => (
            <button
              className="border-border/30 bg-card/20 text-muted-foreground/70 hover:border-border/60 hover:bg-card/40 hover:text-muted-foreground rounded-xl border px-3 py-2.5 text-left text-[11px] leading-relaxed transition-all duration-200"
              key={suggestion}
              onClick={() => handleAction(suggestion)}
              type="button"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      <div className="shrink-0 px-5 pb-5">
        <button
          className="border-border/30 bg-card/30 text-muted-foreground/40 hover:border-border/50 hover:text-muted-foreground/60 flex w-full items-center rounded-2xl border px-4 py-3 text-left text-[13px] transition-colors"
          onClick={() => handleAction()}
          type="button"
        >
          Ask anything...
        </button>
      </div>
    </div>
  );
}
