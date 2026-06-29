import type { Metadata } from "next";
import Link from "next/link";
import config from "@payload-config";
import { getPayload } from "payload";

import type { ExtBillingPlan as Plan } from "@acme/cms";
import { getExtensionSettings } from "@acme/ext-kit/payload";
import { cn } from "@acme/ui";
import { Badge } from "@acme/ui/badge";
import { buttonVariants } from "@acme/ui/button";

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

interface Feature {
  text: string;
  included?: boolean | null;
}

/** Filled check-circle. Inline SVG so the extension needs no icon dependency. */
function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/**
 * A single Launch-UI-style pricing card. Mirrors the kit's `PricingColumn`
 * (apps/nextjs launch-ui) but stays self-contained in the billing extension —
 * it can't reach the host `~/components`, so it composes the same look from
 * `@acme/ui` primitives + Tailwind tokens. Card order matches the Launch UI
 * default: name/badge → description → price → CTA → feature list.
 */
function PricingCard({
  name,
  badge,
  description,
  priceLabel,
  cadenceLabel,
  note,
  features = [],
  cta,
  highlighted = false,
}: {
  name: string;
  badge?: string | null;
  description?: string | null;
  priceLabel: string;
  cadenceLabel?: string;
  note?: string | null;
  features?: Feature[];
  cta: React.ReactNode;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col gap-6 rounded-xl border p-6 shadow-sm",
        highlighted
          ? "border-primary glass-4 ring-primary/30 ring-1"
          : "border-border bg-card",
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">{name}</h3>
          {badge ? <Badge>{badge}</Badge> : null}
        </div>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-end gap-1.5">
          <span className="text-4xl font-bold tracking-tight">
            {priceLabel}
          </span>
          {cadenceLabel ? (
            <span className="text-muted-foreground pb-1 text-sm">
              {cadenceLabel}
            </span>
          ) : null}
        </div>
        {note ? <p className="text-muted-foreground text-xs">{note}</p> : null}
      </div>

      {cta}

      {features.length > 0 ? (
        <ul className="flex flex-col gap-2.5 text-sm">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircleIcon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  f.included === false
                    ? "text-muted-foreground/50"
                    : "text-primary",
                )}
              />
              <span
                className={
                  f.included === false
                    ? "text-muted-foreground line-through"
                    : ""
                }
              >
                {f.text}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * The public pricing page (RSC, billing's `/pricing` mount). A mobile-first
 * landing layout that fans out to a multi-column grid on larger screens, styled
 * to match the kit's Launch UI pricing section. Plans are authored in Payload
 * and curated by billing's admin settings (featured plans, Free + Enterprise
 * tiers). Each paid plan's CTA leads to the two-step `/checkout?plan=<id>`
 * (account → payment); the Free tier links to sign-up and the Enterprise tier to
 * a staff-configured "Contact Sales" link (no Stripe). Reads degrade gracefully:
 * if Payload can't initialize yet, render defaults + an empty plan list instead
 * of failing the request.
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
    <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-12 px-4 py-16 sm:py-24">
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

      <div className="grid w-full items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {freeTier && (
          <PricingCard
            name={freeTier.name ?? "Free"}
            description={freeTier.description}
            priceLabel="$0"
            features={freeTier.features ?? []}
            cta={
              <Link
                href={freeHref}
                className={buttonVariants({ variant: "outline" })}
              >
                {freeTier.ctaLabel ?? "Get started"}
              </Link>
            }
          />
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
            <PricingCard
              key={plan.id}
              name={plan.name}
              badge={plan.badge}
              description={plan.description}
              priceLabel={formatPrice(
                introAmount ?? plan.unitAmount,
                plan.currency,
              )}
              cadenceLabel={cadence(plan)}
              note={
                introAmount != null
                  ? `then ${formatPrice(plan.unitAmount, plan.currency)}${cadence(plan)}`
                  : null
              }
              features={plan.features ?? []}
              highlighted={Boolean(plan.highlighted)}
              cta={
                <Link
                  href={`/checkout?plan=${encodeURIComponent(String(plan.id))}`}
                  className={buttonVariants({
                    variant: plan.highlighted ? "default" : "outline",
                  })}
                >
                  Continue
                </Link>
              }
            />
          );
        })}

        {enterprise && (
          <PricingCard
            name={enterprise.name ?? "Enterprise"}
            description={enterprise.description}
            priceLabel="Custom"
            features={enterprise.features ?? []}
            cta={
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
            }
          />
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
