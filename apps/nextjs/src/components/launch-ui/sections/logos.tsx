import { Badge } from "../ui/badge";
import { Section } from "../ui/section";

export interface LogoItem {
  name: string;
  /** Optional uploaded image URL; falls back to the name as text. */
  src?: string;
}

export interface LogosProps {
  title?: string;
  badgeText?: string;
  logos?: LogoItem[] | false;
  className?: string;
}

export default function Logos({
  title = "Built with industry-standard tools and best practices",
  badgeText,
  logos = false,
  className,
}: LogosProps) {
  return (
    <Section className={className}>
      <div className="max-w-container mx-auto flex flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-6">
          {badgeText && (
            <Badge variant="outline" className="border-brand/30 text-brand">
              {badgeText}
            </Badge>
          )}
          <h2 className="text-md font-semibold sm:text-2xl">{title}</h2>
        </div>
        {logos !== false && logos.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-8">
            {logos.map((logo) => (
              <div
                key={logo.name}
                className="flex items-center gap-2 text-sm font-medium"
              >
                {logo.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logo.src}
                    alt={logo.name}
                    className="h-8 max-w-[140px] object-contain opacity-70"
                  />
                ) : (
                  <span className="text-muted-foreground">{logo.name}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
