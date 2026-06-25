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

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, transparent pricing. Start free, upgrade anytime.",
};

interface TierCard {
  name?: string | null;
  description?: string | null;
  ctaLabel?: string | null;
  link?: { url?: string | null; newTab?: boolean | null } | null;
  features?: { text: string; included?: boolean | null }[] | null;
}

interface PricingSettingsData extends Record<string, unknown> {
  heading: string;
  subheading: string;
  showFreeTier: boolean;
  showEnterpriseTier?: boolean | null;
  featuredPlans?: (Plan | number)[] | null;
  freeTier?: TierCard | null;
  enterpriseTier?: TierCard | null;
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

/** Shared bullet list for a tier card. */
function Features({
  features,
}: {
  features?: { text: string; included?: boolean | null }[] | null;
}) {
  return (
    <ul className="text-muted-foreground flex-1 space-y-1 text-sm">
      {(features ?? []).map((f, i) => (
        <li key={i} className={f.included === false ? "line-through" : ""}>
          • {f.text}
        </li>
      ))}
    </ul>
  );
}

/**
 * The public pricing page (RSC, billing's `/pricing` mount). A mobile-first
 * landing layout that fans out to a multi-column grid on larger screens. Plans
 * are authored in Payload and curated by billing's admin settings (featured
 * plans, Free + Enterprise tiers). Each paid plan's CTA leads to the two-step
 * `/checkout?plan=<id>` (account → payment); the Free tier links to sign-up and
 * the Enterprise tier to a staff-configured "Contact Sales" link (no Stripe).
 * Reads degrade gracefully: if Payload can't initialize yet, render defaults +
 * an empty plan list instead of failing the request.
 */
export async function PricingPage() {
  let pricing: PricingSettingsData = settings.defaults as PricingSettingsData;
  let plans: Plan[] = [];
  try {
    const payload = await getPayload({ config });
    pricing = await getExtensionSettings<PricingSettingsData>(
      payload,
      settings,
    );
    const featured = (pricing.featuredPlans ?? []).filter(
      (p): p is Plan => typeof p === "object",
    );
    plans =
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
  } catch {
    // CMS unreachable — defaults + empty list (matches lib/payload.ts safe()).
  }

  const freeTier = pricing.showFreeTier ? pricing.freeTier : null;
  const freeHref = freeTier?.link?.url ?? "/sign-up";
  const enterprise = pricing.showEnterpriseTier ? pricing.enterpriseTier : null;
  const enterpriseHref = enterprise?.link?.url ?? "mailto:sales@example.com";

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-10 px-4 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {pricing.heading}
        </h1>
        {pricing.subheading && (
          <p className="text-muted-foreground max-w-xl text-lg">
            {pricing.subheading}
          </p>
        )}
      </div>

      <div className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {freeTier && (
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>{freeTier.name ?? "Free"}</CardTitle>
              <CardDescription>{freeTier.description}</CardDescription>
              <p className="text-3xl font-bold">$0</p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <Features features={freeTier.features} />
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
              <CardContent className="flex flex-1 flex-col gap-4">
                <Features features={plan.features} />
                <Link
                  href={`/checkout?plan=${encodeURIComponent(String(plan.id))}`}
                  className={buttonVariants({
                    variant: plan.highlighted ? "default" : "outline",
                  })}
                >
                  Continue
                </Link>
              </CardContent>
            </Card>
          );
        })}

        {enterprise && (
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>{enterprise.name ?? "Enterprise"}</CardTitle>
              <CardDescription>{enterprise.description}</CardDescription>
              <p className="text-3xl font-bold">Custom</p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <Features features={enterprise.features} />
              <Link
                href={enterpriseHref}
                target={enterprise.link?.newTab ? "_blank" : undefined}
                rel={
                  enterprise.link?.newTab ? "noopener noreferrer" : undefined
                }
                className={buttonVariants({ variant: "outline" })}
              >
                {enterprise.ctaLabel ?? "Contact sales"}
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {pricing.disclaimer && (
        <p className="text-muted-foreground max-w-2xl text-center text-xs">
          {pricing.disclaimer}
        </p>
      )}
    </section>
  );
}
