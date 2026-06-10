import type { PricingColumnProps } from "../ui/pricing-column";
import { PricingColumn } from "../ui/pricing-column";
import { Section } from "../ui/section";

export interface PricingProps {
  heading?: string;
  subheading?: string;
  columns: PricingColumnProps[];
}

/**
 * Public pricing section — a responsive grid of pricing cards. The cards (and
 * their CTAs) are assembled by the caller (the /pricing RSC) from the Payload
 * Plans + PricingSettings, so this stays a presentational Launch UI section.
 */
export default function Pricing({
  heading = "Pricing",
  subheading,
  columns,
}: PricingProps) {
  return (
    <Section>
      <div className="max-w-container mx-auto flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-semibold sm:text-4xl">{heading}</h2>
          {subheading ? (
            <p className="text-muted-foreground max-w-[640px]">{subheading}</p>
          ) : null}
        </div>
        <div className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {columns.map((col) => (
            <PricingColumn key={col.name} {...col} />
          ))}
        </div>
      </div>
    </Section>
  );
}
