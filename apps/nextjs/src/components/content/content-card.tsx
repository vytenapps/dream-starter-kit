import type { ReactNode } from "react";
import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export interface ContentCardProps {
  title: string;
  href?: string;
  /** External link (opens in a new tab). */
  external?: boolean;
  image?: { url: string; alt: string } | null;
  meta?: ReactNode;
  description?: string | null;
}

/**
 * A uniform content card (optional cover image + title + meta + description),
 * used across the article/event/video/location list pages. Wrapped in a link
 * when `href` is provided.
 */
export function ContentCard({
  title,
  href,
  external,
  image,
  meta,
  description,
}: ContentCardProps) {
  const card = (
    <Card className="hover:border-foreground/20 h-full gap-0 overflow-hidden py-0 transition-colors">
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image.url}
          alt={image.alt}
          className="aspect-video w-full object-cover"
        />
      )}
      <CardHeader className="py-6">
        <CardTitle className="text-xl">{title}</CardTitle>
        {meta && <p className="text-muted-foreground text-sm">{meta}</p>}
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
    </Card>
  );

  if (!href) return card;
  return (
    <Link
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {card}
    </Link>
  );
}

/** A responsive grid wrapper for content cards inside a Section. */
export function ContentGrid({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-container mx-auto grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  );
}

/** Empty-state message shown when a collection has no published rows. */
export function ContentEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground mx-auto text-center">{children}</p>
  );
}
