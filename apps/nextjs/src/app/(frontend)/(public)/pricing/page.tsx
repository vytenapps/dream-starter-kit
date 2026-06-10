import type { Metadata } from "next";
import Link from "next/link";

import type { Plan } from "@acme/cms";

import type { PricingColumnProps } from "~/components/launch-ui/ui/pricing-column";
import Pricing from "~/components/launch-ui/sections/pricing";
import { PlanCheckoutButton } from "~/components/plan-checkout-button";
import { buttonVariants } from "~/components/ui/button";
import { getPricingSettings, listActivePlans } from "~/lib/payload";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, transparent pricing. Start free, upgrade anytime.",
};

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

function toColumn(plan: Plan): PricingColumnProps {
  const features = (plan.features ?? []).map((f) => f.text);
  const intro = plan.introOffer;
  const introAmount =
    plan.pricingType === "recurring" &&
    intro?.enabled &&
    intro.introAmount != null
      ? intro.introAmount
      : null;
  const hasIntro = introAmount != null;

  const note = hasIntro
    ? `for the first ${plan.interval === "year" ? "year" : "month"}, then ${formatPrice(plan.unitAmount, plan.currency)}${cadence(plan)}`
    : plan.trialDays
      ? `${plan.trialDays}-day free trial`
      : plan.pricingType === "one_time"
        ? "one-time payment"
        : undefined;

  return {
    name: plan.name,
    description: plan.description ?? undefined,
    priceLabel: formatPrice(introAmount ?? plan.unitAmount, plan.currency),
    cadence: cadence(plan),
    originalPriceLabel: hasIntro
      ? formatPrice(plan.unitAmount, plan.currency)
      : undefined,
    note,
    features,
    badge: plan.badge ?? undefined,
    highlighted: plan.highlighted ?? false,
    cta: (
      <PlanCheckoutButton
        planId={plan.id}
        label={plan.highlighted ? "Get started" : "Choose plan"}
        variant={plan.highlighted ? "default" : "outline"}
        className="w-full"
      />
    ),
  };
}

export default async function PricingPage() {
  const [settings, activePlans] = await Promise.all([
    getPricingSettings(),
    listActivePlans(),
  ]);

  // Staff-curated picks (depth 1 → Plan objects), else all active plans.
  const featured = (settings?.featuredPlans ?? []).filter(
    (p): p is Plan => typeof p === "object",
  );
  const plans = featured.length > 0 ? featured : activePlans;

  const columns: PricingColumnProps[] = [];

  if (settings?.showFreeTier !== false) {
    const free = settings?.freeTier;
    columns.push({
      name: free?.name ?? "Free",
      description: free?.description ?? "Everything you need to get started.",
      priceLabel: "$0",
      cadence: "",
      features: (free?.features ?? []).map((f) => f.text),
      cta: (
        <Link
          href="/sign-up"
          className={buttonVariants({ variant: "outline" })}
        >
          {free?.ctaLabel ?? "Get started"}
        </Link>
      ),
    });
  }

  columns.push(...plans.map(toColumn));

  return (
    <main>
      <Pricing
        heading={settings?.heading ?? "Pricing"}
        subheading={settings?.subheading ?? undefined}
        columns={columns}
      />
    </main>
  );
}
