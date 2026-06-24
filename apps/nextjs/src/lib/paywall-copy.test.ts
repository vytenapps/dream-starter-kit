import { describe, expect, it } from "vitest";

import type { PlanLite } from "./paywall-copy";
import {
  buildPlanCopy,
  buildUpsellCopy,
  cadence,
  deferredElementsOptions,
  formatPrice,
  resolveAnnualPlan,
  resolvePremiumPlan,
} from "./paywall-copy";

describe("formatPrice", () => {
  it("drops decimals on whole-dollar amounts", () => {
    expect(formatPrice(3999)).toBe("$39.99");
    expect(formatPrice(39900)).toBe("$399");
    expect(formatPrice(199)).toBe("$1.99");
  });
  it("omits the symbol for non-usd", () => {
    expect(formatPrice(1000, "eur")).toBe("10");
  });
});

describe("cadence", () => {
  it("maps interval to a suffix; one-time has none", () => {
    expect(
      cadence({ id: 1, pricingType: "recurring", interval: "month" }),
    ).toBe("/mo");
    expect(cadence({ id: 1, pricingType: "recurring", interval: "year" })).toBe(
      "/yr",
    );
    expect(cadence({ id: 1, pricingType: "one_time" })).toBe("");
  });
});

const introPlan: PlanLite = {
  id: 1,
  name: "Dream Monthly",
  pricingType: "recurring",
  interval: "month",
  unitAmount: 3999,
  currency: "usd",
  introOffer: {
    enabled: true,
    introAmount: 199,
    introInterval: "month",
    introPeriods: 1,
  },
};

describe("buildPlanCopy — intro offer (CMS-driven)", () => {
  const copy = buildPlanCopy(introPlan);

  it("derives the headline + price line from the plan's real numbers", () => {
    expect(copy.headline).toContain("$1.99");
    expect(copy.headline).toContain("first month");
    expect(copy.priceLine).toBe("$1.99 for your first month, then $39.99/mo");
  });

  it("composes fine print covering intro → renewal → cancel", () => {
    expect(copy.fineprint).toContain("$1.99 today");
    expect(copy.fineprint).toContain("renews at $39.99/mo");
    expect(copy.fineprint).toContain("cancel");
    expect(copy.shortTerms).toBe(
      "$1.99 today, then $39.99/mo. Cancel anytime.",
    );
    expect(copy.cta).toBe("Subscribe");
  });

  it("uses multi-period intro wording when introPeriods > 1", () => {
    const copy3 = buildPlanCopy({
      ...introPlan,
      introOffer: {
        enabled: true,
        introAmount: 199,
        introInterval: "month",
        introPeriods: 3,
      },
    });
    expect(copy3.priceLine).toContain("first 3 months");
  });
});

describe("buildPlanCopy — free trial", () => {
  it("describes the trial then the renewal price", () => {
    const copy = buildPlanCopy({
      id: 2,
      pricingType: "recurring",
      interval: "month",
      unitAmount: 999,
      currency: "usd",
      trialDays: 7,
    });
    expect(copy.headline).toContain("7-day free trial");
    expect(copy.cta).toBe("Start free trial");
    expect(copy.fineprint).toContain("7-day free trial");
    expect(copy.fineprint).toContain("renews at $9.99/mo");
  });
});

describe("buildPlanCopy — plain recurring", () => {
  it("falls back to a simple recurring line", () => {
    const copy = buildPlanCopy({
      id: 3,
      pricingType: "recurring",
      interval: "year",
      unitAmount: 9900,
      currency: "usd",
    });
    expect(copy.priceLine).toBe("$99/yr");
    expect(copy.fineprint).toContain("renews at $99/yr");
  });
});

describe("buildPlanCopy — one-time", () => {
  it("frames a one-time unlock, not a subscription", () => {
    const copy = buildPlanCopy({
      id: 4,
      pricingType: "one_time",
      unitAmount: 4900,
      currency: "usd",
    });
    expect(copy.cta).toBe("Unlock");
    expect(copy.fineprint).toContain("one-time payment");
    expect(copy.priceLine).toBe("$49");
  });
});

describe("deferredElementsOptions", () => {
  it("charges the intro amount today for an intro subscription", () => {
    expect(deferredElementsOptions(introPlan)).toEqual({
      mode: "subscription",
      amount: 199,
      currency: "usd",
    });
  });

  it("charges the unit price for a plain recurring plan", () => {
    expect(
      deferredElementsOptions({
        id: 1,
        pricingType: "recurring",
        interval: "year",
        unitAmount: 9900,
        currency: "usd",
      }),
    ).toEqual({ mode: "subscription", amount: 9900, currency: "usd" });
  });

  it("uses setup mode for a $0-today free trial", () => {
    const opts = deferredElementsOptions({
      id: 1,
      pricingType: "recurring",
      interval: "month",
      unitAmount: 999,
      currency: "usd",
      trialDays: 7,
    });
    expect(opts).toEqual({ mode: "setup", currency: "usd" });
  });

  it("charges the unit price for a one-time plan", () => {
    expect(
      deferredElementsOptions({
        id: 1,
        pricingType: "one_time",
        unitAmount: 4900,
        currency: "usd",
      }),
    ).toEqual({ mode: "payment", amount: 4900, currency: "usd" });
  });

  it("returns null when the plan isn't loaded yet", () => {
    expect(deferredElementsOptions(null)).toBeNull();
  });
});

describe("resolvePremiumPlan", () => {
  it("picks the cheapest recurring plan", () => {
    const docs: PlanLite[] = [
      { id: 1, pricingType: "recurring", unitAmount: 9900 },
      { id: 2, pricingType: "recurring", unitAmount: 3999 },
      { id: 3, pricingType: "one_time", unitAmount: 50000 },
    ];
    expect(resolvePremiumPlan(docs)?.id).toBe(2);
  });

  it("falls back to the cheapest plan when none are recurring", () => {
    const docs: PlanLite[] = [
      { id: 1, pricingType: "one_time", unitAmount: 5000 },
      { id: 2, pricingType: "one_time", unitAmount: 1999 },
    ];
    expect(resolvePremiumPlan(docs)?.id).toBe(2);
  });

  it("returns null for an empty list", () => {
    expect(resolvePremiumPlan([])).toBeNull();
  });
});

describe("resolveAnnualPlan", () => {
  const docs: PlanLite[] = [
    { id: 1, pricingType: "recurring", interval: "month", unitAmount: 3999 },
    { id: 2, pricingType: "recurring", interval: "year", unitAmount: 39900 },
    { id: 3, pricingType: "one_time", unitAmount: 99900 },
  ];

  it("picks the cheapest yearly recurring plan distinct from the primary", () => {
    expect(resolveAnnualPlan(docs, 1)?.id).toBe(2);
  });

  it("excludes the primary plan itself", () => {
    expect(resolveAnnualPlan(docs, 2)).toBeNull();
  });

  it("returns null when there's no yearly plan", () => {
    expect(
      resolveAnnualPlan(
        [
          {
            id: 1,
            pricingType: "recurring",
            interval: "month",
            unitAmount: 999,
          },
        ],
        1,
      ),
    ).toBeNull();
  });
});

const monthlyPlan: PlanLite = {
  id: 10,
  name: "Dream Monthly",
  pricingType: "recurring",
  interval: "month",
  unitAmount: 3999,
  currency: "usd",
  introOffer: {
    enabled: true,
    introAmount: 199,
    introInterval: "month",
    introPeriods: 1,
  },
};

describe("buildUpsellCopy — annual intro framing", () => {
  const annualIntroPlan: PlanLite = {
    id: 11,
    name: "Dream Annual",
    pricingType: "recurring",
    interval: "year",
    unitAmount: 39900,
    currency: "usd",
    introOffer: {
      enabled: true,
      introAmount: 17801,
      introInterval: "year",
      introPeriods: 1,
    },
  };
  const copy = buildUpsellCopy(annualIntroPlan, monthlyPlan);

  it("first-year total = annual intro charged now + monthly already paid", () => {
    // 17801 + 199 = 18000 -> $180
    expect(copy.priceLine).toBe("$180 for your first year, then $399/yr");
  });

  it("shows the discount vs the full annual price", () => {
    // 39900 - 18000 = 21900 -> $219
    expect(copy.savingsLine).toBe("$219 discount");
  });

  it("charges only the annual intro today and renews at the full price", () => {
    expect(copy.fineprint).toContain("$178.01 now");
    expect(copy.fineprint).toContain("$180 total");
    expect(copy.fineprint).toContain("renews at $399/yr");
    expect(copy.cta).toBe("Switch to Annual");
  });
});

describe("buildUpsellCopy — savings framing (no annual intro)", () => {
  const plainAnnual: PlanLite = {
    id: 12,
    name: "Dream Annual",
    pricingType: "recurring",
    interval: "year",
    unitAmount: 39900,
    currency: "usd",
  };
  const copy = buildUpsellCopy(plainAnnual, monthlyPlan);

  it("charges the full annual price and frames savings vs annualized monthly", () => {
    expect(copy.priceLine).toBe("$399/yr");
    // 3999 * 12 = 47988; 47988 - 39900 = 8088 -> $80.88
    expect(copy.savingsLine).toBe("Save $80.88/year vs monthly");
    expect(copy.fineprint).toContain("$399 now");
  });
});
