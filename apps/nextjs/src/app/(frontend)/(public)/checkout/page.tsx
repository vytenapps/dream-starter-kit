import type { Metadata } from "next";
import { redirect } from "next/navigation";
import config from "@payload-config";
import { getPayload } from "payload";

import type { ExtBillingPlan, Media, Review } from "@acme/cms";

import type { CheckoutTestimonialData } from "~/components/checkout/checkout-testimonial";
import type { PlanLite } from "~/lib/paywall-copy";
import { CheckoutFlow } from "~/components/checkout/checkout-flow";
import { getAuthSettings, getBranding } from "~/lib/payload";
import { resolveAnnualPlan } from "~/lib/paywall-copy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

/** Pull the public URL off a populated media relation (id-only ⇒ undefined). */
function mediaUrl(
  value: Media | number | null | undefined,
): string | undefined {
  return value && typeof value === "object"
    ? (value.url ?? undefined)
    : undefined;
}

/** Build the testimonial card data from a populated, approved review. */
function toTestimonial(review: Review): CheckoutTestimonialData | null {
  if (review.status !== "approved" || !review.body?.trim()) return null;
  const author = typeof review.author === "object" ? review.author : null;
  const authorName =
    [author?.displayName, author?.username]
      .map((s) => s?.trim())
      .find((s) => s) ?? "A happy customer";
  return {
    quote: review.body,
    rating: review.rating,
    authorName,
    authorTitle: review.authorTitle ?? null,
    avatarUrl: author ? mediaUrl(author.avatar) : undefined,
  };
}

/**
 * The Bloomberg-style two-step checkout (Account → Payment). Server-loads the
 * selected plan + the curated checkout testimonial + auth settings, then hands
 * off to the client `CheckoutFlow`. Plans are authored in Payload; the buyer
 * arrives here from the /pricing "Continue" CTA with `?plan=<id>`.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; step?: string }>;
}) {
  const { plan: planParam } = await searchParams;
  if (!planParam) redirect("/pricing");

  let plan: ExtBillingPlan | null = null;
  let annualPlan: ExtBillingPlan | null = null;
  let testimonial: CheckoutTestimonialData | null = null;

  try {
    const payload = await getPayload({ config });

    plan = await payload
      .findByID({ collection: "ext-billing-plans", id: planParam, depth: 0 })
      .catch(() => null);

    if (plan && plan.active !== false) {
      // The annual plan offered as a post-purchase 1-click upgrade (if distinct).
      const all = await payload
        .find({
          collection: "ext-billing-plans",
          where: { active: { equals: true } },
          depth: 0,
          limit: 100,
        })
        .catch(() => ({ docs: [] as ExtBillingPlan[] }));
      annualPlan = resolveAnnualPlan(
        all.docs as unknown as PlanLite[],
        plan.id,
      ) as unknown as ExtBillingPlan | null;

      // Curated checkout testimonial: read the featured review id from settings,
      // then fetch it populated (author + avatar).
      const billing = await payload
        .findGlobal({ slug: "ext-billing-settings", depth: 0 })
        .catch(() => null);
      const featured = billing?.featuredReview;
      const reviewId = typeof featured === "object" ? featured?.id : featured;
      if (reviewId != null) {
        const review = await payload
          .findByID({ collection: "reviews", id: reviewId, depth: 2 })
          .catch(() => null);
        if (review) testimonial = toTestimonial(review);
      }
    }
  } catch {
    // CMS unreachable — fall through to the redirect guard below.
  }

  // Redirect OUTSIDE the try/catch: Next's redirect() throws a control-flow
  // signal that a surrounding catch would otherwise swallow.
  if (!plan || plan.active === false) redirect("/pricing");

  const [authSettings, branding] = await Promise.all([
    getAuthSettings(),
    getBranding(),
  ]);

  return (
    <CheckoutFlow
      planId={plan.id}
      plan={plan}
      annualPlan={annualPlan}
      authSettings={authSettings}
      appName={branding.appName}
      testimonial={testimonial}
    />
  );
}
