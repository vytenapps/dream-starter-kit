// Right-rail social-proof card on the checkout page. Sourced from the
// `featuredReview` curated in Billing settings (a core `reviews` row): its body
// is the quote, its rating the stars, the author's name/avatar identify them,
// and the optional `authorTitle` is their role line.
import { Star } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Card, CardContent } from "~/components/ui/card";

export interface CheckoutTestimonialData {
  quote: string;
  rating: number;
  authorName: string;
  authorTitle?: string | null;
  avatarUrl?: string | null;
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((part) => part[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "★"
  );
}

export function CheckoutTestimonial({
  testimonial,
}: {
  testimonial: CheckoutTestimonialData;
}) {
  const rating = Math.max(0, Math.min(5, Math.round(testimonial.rating)));
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={
                i < rating
                  ? "size-4 fill-amber-400 text-amber-400"
                  : "text-muted-foreground/30 size-4"
              }
            />
          ))}
        </div>
        <blockquote className="text-sm leading-relaxed">
          “{testimonial.quote}”
        </blockquote>
        <div className="flex items-center gap-3">
          <Avatar>
            {testimonial.avatarUrl && (
              <AvatarImage
                src={testimonial.avatarUrl}
                alt={testimonial.authorName}
              />
            )}
            <AvatarFallback>{initialsOf(testimonial.authorName)}</AvatarFallback>
          </Avatar>
          <div className="leading-tight">
            <p className="text-sm font-medium">{testimonial.authorName}</p>
            {testimonial.authorTitle && (
              <p className="text-muted-foreground text-xs">
                {testimonial.authorTitle}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
