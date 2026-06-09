import { Section } from "~/components/launch-ui/ui/section";

/**
 * Launch UI-styled page header for content collection pages (articles, events,
 * …) — a centered title + optional description inside a Section, matching the
 * marketing sections' rhythm.
 */
export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <Section className="pb-0 sm:pb-0 md:pb-0">
      <div className="max-w-container mx-auto flex flex-col items-center gap-4 text-center">
        <h1 className="from-foreground to-foreground dark:to-muted-foreground bg-linear-to-r bg-clip-text text-4xl leading-tight font-semibold text-balance text-transparent sm:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground max-w-[640px] text-balance">
            {description}
          </p>
        )}
      </div>
    </Section>
  );
}
