import type { Metadata } from "next";
import Link from "next/link";
import config from "@payload-config";
import { getPayload } from "payload";

import type { ExtBillingPlan as Plan } from "@acme/cms";
import { getExtensionSettings } from "@acme/ext-kit/payload";
import { cn } from "@acme/ui";
import { Badge } from "@acme/ui/badge";
import { buttonVariants } from "@acme/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@acme/ui/card";

import { settings } from "../payload/settings";
import { PlanCheckoutButton } from "../web/plan-checkout-button";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, transparent pricing. Start free, upgrade anytime.",
};

interface PricingSettingsData extends Record<string, unknown> {
  heading: string;
  subheading: string;
  showFreeTier: boolean;
  featuredPlans?: (Plan | number)[] | null;
  freeTier?: {
    name?: string | null;
    description?: string | null;
    ctaLabel?: string | null;
    link?: { url?: string | null } | null;
    features?: { text: string; included?: boolean | null }[] | null;
  } | null;
  disclaimer?: string | null;
}

/** "$9.99" / "$399" — drop the decimals on whole-dollar amounts. */
function formatPrice(cents: number, currency = "usd"): string {
  const symbol = currency.toLowerCase() === "usd" ? "$" : "";
  const dollars = cents / 100;
  return `${symbol}${cents % 100 === 0 ? dollars : dollars.toFixed(2)}`;
}

function cadence(plan: Plan): string {
  if (plan.pricingType === "one_time") return "";
  return plan.interval === "year" ? "/yr" : "/mo";
}

/**
 * The public pricing page (RSC, billing's `/pricing` mount). Plans are
 * authored in Payload; the page is curated by billing's admin settings screen
 * (featured plans + Free tier). Fetched via the Local API for SEO/perf —
 * extension web entries may use it (EXTENSIONS-PLAN.md §1.2).
 */
export async function PricingPage() {
  const payload = await getPayload({ config });
  const pricing = await getExtensionSettings<PricingSettingsData>(
    payload,
    settings,
  );

  const featured = (pricing.featuredPlans ?? []).filter(
    (p): p is Plan => typeof p === "object",
  );
  const plans: Plan[] =
    featured.length > 0
      ? featured
      : (
          await payload
            .find({
              collection: "ext-billing-plans",
              where: { active: { equals: true } },
              sort: "displayOrder",
              depth: 0,
              limit: 100,
            })
            .catch(() => ({ docs: [] as Plan[] }))
        ).docs;

  const freeTier = pricing.showFreeTier ? pricing.freeTier : null;
  const freeHref = freeTier?.link?.url ?? "/sign-up";

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8 px-4 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-4xl font-semibold">{pricing.heading}</h1>
        {pricing.subheading && (
          <p className="text-muted-foreground max-w-xl">{pricing.subheading}</p>
        )}
      </div>

      <div className="grid w-full gap-4 md:grid-cols-2 lg:grid-cols-4">
        {freeTier && (
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>{freeTier.name ?? "Free"}</CardTitle>
              <CardDescription>{freeTier.description}</CardDescription>
              <p className="text-3xl font-bold">$0</p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <ul className="text-muted-foreground flex-1 space-y-1 text-sm">
                {(freeTier.features ?? []).map((f, i) => (
                  <li key={i}>• {f.text}</li>
                ))}
              </ul>
              <Link
                href={freeHref}
                className={buttonVariants({ variant: "outline" })}
              >
                {freeTier.ctaLabel ?? "Get started"}
              </Link>
            </CardContent>
          </Card>
        )}

        {plans.map((plan) => {
          const intro = plan.introOffer;
          const introAmount =
            plan.pricingType === "recurring" &&
            intro?.enabled &&
            intro.introAmount != null
              ? intro.introAmount
              : null;
          return (
            <Card
              key={plan.id}
              className={cn(
                "flex flex-col",
                plan.highlighted && "border-primary shadow-md",
              )}
            >
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{plan.name}</CardTitle>
                  {plan.badge && <Badge>{plan.badge}</Badge>}
                </div>
                <CardDescription>{plan.description}</CardDescription>
                <p className="text-3xl font-bold">
                  {formatPrice(introAmount ?? plan.unitAmount, plan.currency)}
                  <span className="text-muted-foreground text-base font-normal">
                    {cadence(plan)}
                  </span>
                </p>
                {introAmount != null && (
                  <p className="text-muted-foreground text-xs">
                    then {formatPrice(plan.unitAmount, plan.currency)}
                    {cadence(plan)}
                  </p>
                )}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <ul className="text-muted-foreground flex-1 space-y-1 text-sm">
                  {(plan.features ?? []).map((f, i) => (
                    <li key={i}>• {f.text}</li>
                  ))}
                </ul>
                <PlanCheckoutButton
                  planId={plan.id}
                  variant={plan.highlighted ? "default" : "outline"}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {pricing.disclaimer && (
        <p className="text-muted-foreground max-w-2xl text-center text-xs">
          {pricing.disclaimer}
        </p>
      )}
    </section>
  );
}
