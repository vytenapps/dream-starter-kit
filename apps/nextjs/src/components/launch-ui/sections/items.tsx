import type { ReactNode } from "react";

import { InfoTooltip } from "../ui/info-tooltip";
import { Item, ItemDescription, ItemIcon, ItemTitle } from "../ui/item";
import { Section } from "../ui/section";

export interface ItemEntry {
  title: string;
  description: string;
  icon?: ReactNode;
  /** Optional deeper detail, surfaced via an (i) tooltip beside the title. */
  tooltip?: string;
}

export interface ItemsProps {
  title?: string;
  items?: ItemEntry[] | false;
  className?: string;
}

export default function Items({
  title = "Everything you need. Nothing you don't.",
  items = false,
  className,
}: ItemsProps) {
  return (
    <Section className={className}>
      <div className="max-w-container mx-auto flex flex-col items-center gap-6 sm:gap-12">
        <h2 className="max-w-[560px] text-center text-3xl leading-tight font-semibold sm:text-5xl sm:leading-tight">
          {title}
        </h2>
        {items !== false && items.length > 0 && (
          <div className="grid auto-rows-fr grid-cols-2 gap-0 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {items.map((item) => (
              <Item key={item.title}>
                <ItemTitle className="flex items-center gap-2">
                  {item.icon && <ItemIcon>{item.icon}</ItemIcon>}
                  <span className="flex items-center gap-1.5">
                    {item.title}
                    {item.tooltip && (
                      <InfoTooltip
                        text={item.tooltip}
                        label={`More detail: ${item.title}`}
                      />
                    )}
                  </span>
                </ItemTitle>
                <ItemDescription>{item.description}</ItemDescription>
              </Item>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
