/**
 * Pure paywall copy/pricing composer.
 *
 * The in-app paywall (components/paywall) shows the offer headline, the price
 * line, and the fine print. Rather than hardcode them, this module derives them
 * from the actual Payload CMS billing plan (price, currency, interval, intro
 * offer, trial) so the paywall always mirrors what staff authored in /admin.
 * Deliberately free of React / Stripe / server imports so it is unit-testable
 * and safe to import from a client component.
 */

/**
 * Buyer identity captured at checkout — from the Apple/Google Pay sheet
 * (`billingDetails`) or the card form. Used to convert an anonymous account to
 * a permanent one (email) and to persist profile data. All fields optional;
 * the wallet decides what it shares.
 */
export interface BuyerDetails {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  /** Stripe billing address object (loosely typed — persisted as-is). */
  address?: Record<string, unknown> | null;
}

/** The subset of a Payload `ext-billing-plans` doc the paywall copy needs. */
export interface PlanLite {
  id: string | number;
  name?: string | null;
  description?: string | null;
  pricingType?: string | null;
  interval?: string | null;
  intervalCount?: number | null;
  unitAmount?: number | null;
  currency?: string | null;
  trialDays?: number | null;
  introOffer?: {
    enabled?: boolean | null;
    introAmount?: number | null;
    introInterval?: string | null;
    introPeriods?: number | null;
  } | null;
}

/**
 * Pick the plan the paywall offers: the cheapest active recurring plan (falling
 * back to the cheapest plan overall, then the first). Shared by the server (SSR
 * seed) and the client fallback fetch so the selection never drifts.
 */
export function resolvePremiumPlan(docs: PlanLite[]): PlanLite | null {
  if (docs.length === 0) return null;
  const byAmount = [...docs].sort(
    (a, b) => (a.unitAmount ?? 0) - (b.unitAmount ?? 0),
  );
  const recurring = byAmount.filter((p) => p.pricingType === "recurring");
  return recurring[0] ?? byAmount[0] ?? null;
}

export interface PaywallCopy {
  /** Screen-1 headline. */
  headline: string;
  /** Screen-1 supporting line. */
  sub: string;
  /** Primary CTA label ("Subscribe" / "Start free trial" / "Unlock"). */
  cta: string;
  /** One-line price summary shown under the headline. */
  priceLine: string;
  /** Compact reassurance line shown beneath the wallet buttons (screen 1). */
  shortTerms: string;
  /** Full fine print shown on the terms/opt-in screen (screen 2). */
  fineprint: string;
}

/** "$9.99" / "$399" / "$1.99" — drop decimals on whole-dollar amounts. */
export function formatPrice(cents: number, currency = "usd"): string {
  const symbol = currency.toLowerCase() === "usd" ? "$" : "";
  const dollars = cents / 100;
  const body =
    cents % 100 === 0 ? dollars.toLocaleString() : dollars.toFixed(2);
  return `${symbol}${body}`;
}

/** "/mo" · "/yr" · "/wk" · "/day" · "" (one-time). */
export function cadence(plan: PlanLite): string {
  if (plan.pricingType === "one_time") return "";
  switch (plan.interval) {
    case "year":
      return "/yr";
    case "week":
      return "/wk";
    case "day":
      return "/day";
    default:
      return "/mo";
  }
}

/** Singular interval noun for prose ("month", "year", …). */
function intervalNoun(interval?: string | null): string {
  switch (interval) {
    case "year":
      return "year";
    case "week":
      return "week";
    case "day":
      return "day";
    default:
      return "month";
  }
}

/** "month" / "3 months" / "year" — the intro period in prose. */
function introPeriodLabel(plan: PlanLite): string {
  const intro = plan.introOffer;
  const periods =
    intro?.introPeriods && intro.introPeriods > 0 ? intro.introPeriods : 1;
  const noun = intervalNoun(intro?.introInterval ?? plan.interval);
  return periods === 1 ? noun : `${periods} ${noun}s`;
}

/** Deferred-mode `<Elements>` options so the wallet renders before any server
 *  round-trip (the PaymentIntent/subscription is created at confirm time). */
export interface DeferredElementsOptions {
  mode: "payment" | "subscription" | "setup";
  /** Charge today, in cents — required for payment/subscription, omit for setup. */
  amount?: number;
  currency: string;
}

/** The enabled intro amount (cents) for a recurring plan, else null. */
function introAmountOf(plan?: PlanLite | null): number | null {
  if (plan?.pricingType !== "recurring") return null;
  if (!plan.introOffer?.enabled) return null;
  return plan.introOffer.introAmount ?? null;
}

/**
 * Compute deferred `<Elements>` options (mode + today's amount + currency) so
 * the Express Checkout wallet button can render immediately — no "preparing
 * secure checkout" wait. Returns null when the amount isn't known yet (plan
 * still loading), so the caller can hold off mounting Elements.
 */
export function deferredElementsOptions(
  plan?: PlanLite | null,
): DeferredElementsOptions | null {
  if (!plan) return null;
  const currency = (plan.currency ?? "usd").toLowerCase();
  if (plan.pricingType === "one_time") {
    return plan.unitAmount != null
      ? { mode: "payment", amount: plan.unitAmount, currency }
      : null;
  }
  // Recurring: today's charge is the intro amount (if any), $0 during a free
  // trial, else the unit price. A $0-today plan collects a payment method via
  // setup mode (matches the express-intent route's setup-intent branch).
  const intro = introAmountOf(plan);
  const hasTrial = (plan.trialDays ?? 0) > 0;
  const today = intro ?? (hasTrial ? 0 : (plan.unitAmount ?? 0));
  return today > 0
    ? { mode: "subscription", amount: today, currency }
    : { mode: "setup", currency };
}

const DEFAULT_SUB =
  "Unlock this premium content and everything else included with your membership.";

/**
 * Compose the paywall's headline / price line / fine print from a CMS plan.
 * `plan` is the resolved Payload plan (pricing source); falls back to generic
 * copy when no plan is configured yet.
 */
export function buildPlanCopy(plan?: PlanLite | null): PaywallCopy {
  const desc = plan?.description?.trim();
  const sub = desc && desc.length > 0 ? desc : DEFAULT_SUB;

  const currency = plan?.currency ?? "usd";
  const full =
    plan?.unitAmount != null ? formatPrice(plan.unitAmount, currency) : null;
  const cad = plan ? cadence(plan) : "/mo";
  const trial =
    plan?.pricingType === "recurring" && plan.trialDays && plan.trialDays > 0
      ? plan.trialDays
      : 0;

  // --- Intro-offer plan (e.g. $1.99 first month, then $39.99/mo) ---
  const introAmount = introAmountOf(plan);
  if (plan && introAmount != null) {
    const introPrice = formatPrice(introAmount, currency);
    const period = introPeriodLabel(plan);
    return {
      headline: `Get unlimited access for just ${introPrice} your first ${period}`,
      sub,
      cta: "Subscribe",
      priceLine: `${introPrice} for your first ${period}, then ${full}${cad}`,
      shortTerms: `${introPrice} today, then ${full}${cad}. Cancel anytime.`,
      fineprint:
        `You'll be charged ${introPrice} today for your first ${period}. After that, your subscription ` +
        `automatically renews at ${full}${cad} until you cancel. You can cancel anytime from billing — ` +
        `cancellations take effect at the end of the current billing period.`,
    };
  }

  // --- Free-trial plan ---
  if (trial > 0 && full) {
    return {
      headline: `Start your ${trial}-day free trial`,
      sub,
      cta: "Start free trial",
      priceLine: `Free for ${trial} days, then ${full}${cad}`,
      shortTerms: `Free for ${trial} days, then ${full}${cad}. Cancel anytime.`,
      fineprint:
        `Your ${trial}-day free trial starts today. After it ends, your subscription automatically renews ` +
        `at ${full}${cad} unless you cancel before the trial ends. You can cancel anytime from billing.`,
    };
  }

  // --- Plain recurring / one-time / fallback ---
  const priceLabel = full ?? "";
  return {
    headline: full
      ? `Get unlimited access for ${priceLabel}${cad}`
      : "Get unlimited access",
    sub,
    cta: plan?.pricingType === "one_time" ? "Unlock" : "Subscribe",
    priceLine: full ? `${priceLabel}${cad}` : "",
    shortTerms: full
      ? `${priceLabel}${cad}. Cancel anytime.`
      : "Cancel anytime.",
    fineprint: full
      ? plan?.pricingType === "one_time"
        ? `You'll be charged ${priceLabel} today — a one-time payment for permanent access.`
        : `You'll be charged ${priceLabel} today. Your subscription automatically renews at ${priceLabel}${cad} ` +
          `until you cancel. You can cancel anytime from billing.`
      : `By subscribing, the payment method you select will be charged on a recurring basis. You can cancel anytime from billing.`,
  };
}

/**
 * The annual plan offered as a 1-click upsell after a (monthly) purchase: the
 * cheapest yearly-interval recurring plan that isn't the just-purchased plan.
 * Returns null when there's no distinct annual plan (then no upsell is shown).
 */
export function resolveAnnualPlan(
  docs: PlanLite[],
  primaryId?: string | number | null,
): PlanLite | null {
  const yearly = docs
    .filter(
      (p) =>
        p.pricingType === "recurring" &&
        p.interval === "year" &&
        p.id !== primaryId,
    )
    .sort((a, b) => (a.unitAmount ?? 0) - (b.unitAmount ?? 0));
  return yearly[0] ?? null;
}

/** Copy for the post-purchase 1-click "Upgrade to Annual" screen. */
export interface UpsellCopy {
  headline: string;
  /** Big price line, e.g. "$180 for your first year, then $399/yr". */
  priceLine: string;
  /** Discount/savings line, e.g. "$219 discount" or "Save $80/year vs monthly". */
  savingsLine: string | null;
  /** Reassurance bullets under the price. */
  benefits: string[];
  /** Full fine print shown beneath the buttons. */
  fineprint: string;
  /** Primary CTA label. */
  cta: string;
}

/**
 * Compose the annual upsell shown right after a monthly subscription succeeds.
 *
 * Pricing is CMS-driven: the annual plan's intro offer (if any) plus what the
 * buyer already paid on the monthly plan. The displayed "first year" total is
 * the annual intro charged-today amount PLUS the monthly intro already paid —
 * mirroring the /upgrade-annual route, which charges only the annual intro today
 * (the monthly charge already happened), so the buyer's real first-year spend
 * equals the displayed number.
 */
export function buildUpsellCopy(
  annual: PlanLite,
  monthly?: PlanLite | null,
): UpsellCopy {
  const currency = annual.currency ?? "usd";
  const annualFull = annual.unitAmount ?? 0;
  const fullLabel = formatPrice(annualFull, currency);
  const cad = cadence(annual); // "/yr"
  const monthlyPaid = introAmountOf(monthly) ?? monthly?.unitAmount ?? 0;

  const annualIntro = introAmountOf(annual);

  // --- Intro framing: first year = annual intro charged now + monthly paid ---
  if (annualIntro != null) {
    const firstYear = annualIntro + monthlyPaid;
    const firstYearLabel = formatPrice(firstYear, currency);
    const discount = annualFull - firstYear;
    return {
      headline: "Upgrade to Annual Access",
      priceLine: `${firstYearLabel} for your first year, then ${fullLabel}${cad}`,
      savingsLine:
        discount > 0 ? `${formatPrice(discount, currency)} discount` : null,
      benefits: [
        "A full year of unlimited access — locked in",
        "Switch instantly using the card on file",
        "Cancel anytime",
      ],
      fineprint:
        `Your plan switches to annual today using the payment method on file. ` +
        `You'll be charged ${formatPrice(annualIntro, currency)} now for the rest of your first year ` +
        `(${firstYearLabel} total including what you've already paid). After your first year, ` +
        `your subscription automatically renews at ${fullLabel}${cad} until you cancel. ` +
        `You can cancel anytime from billing.`,
      cta: "Switch to Annual",
    };
  }

  // --- Savings framing: full annual price, vs annualized monthly ---
  const monthlyFull = monthly?.unitAmount ?? 0;
  const annualizedMonthly = monthlyFull * 12;
  const savings = annualizedMonthly - annualFull;
  return {
    headline: "Upgrade to Annual Access",
    priceLine: `${fullLabel}${cad}`,
    savingsLine:
      savings > 0
        ? `Save ${formatPrice(savings, currency)}/year vs monthly`
        : null,
    benefits: [
      "A full year of unlimited access — locked in",
      "Switch instantly using the card on file",
      "Cancel anytime",
    ],
    fineprint:
      `Your plan switches to annual today using the payment method on file. ` +
      `You'll be charged ${fullLabel} now and your subscription automatically renews at ` +
      `${fullLabel}${cad} until you cancel. You can cancel anytime from billing.`,
    cta: "Switch to Annual",
  };
}
