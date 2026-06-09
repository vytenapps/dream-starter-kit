import type { ReactNode } from "react";

import { Section } from "~/components/launch-ui/ui/section";

/**
 * Shared layout for content detail pages (article, event, location): an
 * optional cover image, title, meta line and a centered article column.
 */
export function DetailLayout({
  title,
  image,
  meta,
  children,
}: {
  title: string;
  image?: { url: string; alt: string } | null;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Section>
      <article className="mx-auto max-w-3xl">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt={image.alt}
            className="mb-8 aspect-video w-full rounded-xl object-cover"
          />
        )}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {meta && (
          <div className="text-muted-foreground mt-3 text-sm">{meta}</div>
        )}
        <div className="mt-8">{children}</div>
      </article>
    </Section>
  );
}
