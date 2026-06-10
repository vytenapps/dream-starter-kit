import { CircleCheck } from "lucide-react";

import { cn } from "@acme/ui";

import { Badge } from "./badge";

export interface PricingColumnProps {
  name: string;
  description?: string;
  /** Headline price, e.g. "$9.99". For intro offers this is the intro price. */
  priceLabel: string;
  /** Cadence suffix, e.g. "/mo", "/yr", or "" for one-time. */
  cadence?: string;
  /** Crossed-out standard price shown when an intro offer is active. */
  originalPriceLabel?: string;
  /** Sub-line under the price, e.g. "then $39.99/mo" or "7-day free trial". */
  note?: string;
  features?: string[];
  badge?: string;
  highlighted?: boolean;
  /** The CTA — a client checkout button or a plain link, supplied by the parent. */
  cta: React.ReactNode;
}

/**
 * A single pricing card. Server component (the interactive CTA is passed in) so
 * it composes cleanly into the RSC pricing page. Built from the kit's existing
 * Launch UI primitives + Tailwind tokens to match the marketing design.
 */
export function PricingColumn({
  name,
  description,
  priceLabel,
  cadence,
  originalPriceLabel,
  note,
  features = [],
  badge,
  highlighted,
  cta,
}: PricingColumnProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 rounded-xl border p-6 shadow-sm",
        highlighted
          ? "border-primary glass-4 ring-primary/30 ring-1"
          : "border-border bg-card",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{name}</h3>
        {badge ? <Badge variant="outline">{badge}</Badge> : null}
      </div>
      {description ? (
        <p className="text-muted-foreground text-sm">{description}</p>
      ) : null}

      <div className="flex flex-col gap-1">
        <div className="flex items-end gap-2">
          {originalPriceLabel ? (
            <span className="text-muted-foreground text-lg line-through">
              {originalPriceLabel}
            </span>
          ) : null}
          <span className="text-4xl font-bold">{priceLabel}</span>
          {cadence ? (
            <span className="text-muted-foreground pb-1 text-sm">
              {cadence}
            </span>
          ) : null}
        </div>
        {note ? <p className="text-muted-foreground text-xs">{note}</p> : null}
      </div>

      {cta}

      {features.length > 0 ? (
        <ul className="flex flex-col gap-2 text-sm">
          {features.map((feature, i) => (
            <li key={i} className="flex items-center gap-2">
              <CircleCheck className="text-primary size-4 shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
