"use client";

import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

/**
 * A small "(i)" affordance that reveals deeper detail on hover/focus. Used by
 * the Items (feature cards) section to keep card copy plain-English while the
 * technical specifics live one tap away. Client component (radix Tooltip) so it
 * can be dropped into the otherwise server-rendered marketing sections.
 */
export function InfoTooltip({ text, label }: { text: string; label?: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger
          type="button"
          aria-label={label ?? "More detail"}
          className="text-muted-foreground/70 hover:text-foreground focus-visible:ring-ring inline-flex shrink-0 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2"
        >
          <Info className="size-3.5" aria-hidden />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-sm leading-snug font-normal">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
