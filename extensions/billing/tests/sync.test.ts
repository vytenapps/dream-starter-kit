import { describe, expect, it, vi } from "vitest";

import type { CouponSyncInput, PlanSyncInput } from "../src/stripe/sync";
import {
  durationInMonths,
  introAmountOff,
  priceNeedsRecreate,
  syncCouponToStripe,
  syncPlanToStripe,
  toUnixSeconds,
} from "../src/stripe/sync";

const basePlan: PlanSyncInput = {
  id: 1,
  name: "Dream Monthly Plan",
  pricingType: "recurring",
  interval: "month",
  unitAmount: 999,
  currency: "usd",
  active: true,
};

describe("pure helpers", () => {
  it("converts repeating duration to months (years × 12)", () => {
    const months = (c: Partial<CouponSyncInput>) =>
      durationInMonths({ duration: "repeating", ...c } as CouponSyncInput);
    expect(months({ durationCount: 6, durationUnit: "month" })).toBe(6);
    expect(months({ durationCount: 2, durationUnit: "year" })).toBe(24);
    expect(
      durationInMonths({ duration: "once" } as CouponSyncInput),
    ).toBeUndefined();
  });

  it("intro amount_off is the difference, or null when not applicable", () => {
    expect(
      introAmountOff({
        ...basePlan,
        introOffer: { enabled: true, introAmount: 199 },
      }),
    ).toBe(800);
    expect(
      introAmountOff({
        ...basePlan,
        introOffer: { enabled: false, introAmount: 199 },
      }),
    ).toBeNull();
    expect(
      introAmountOff({
        ...basePlan,
        pricingType: "one_time",
        introOffer: { enabled: true, introAmount: 1 },
      }),
    ).toBeNull();
  });

  it("toUnixSeconds converts ISO to seconds and tolerates null", () => {
    expect(toUnixSeconds("2030-01-01T00:00:00.000Z")).toBe(1893456000);
    expect(toUnixSeconds(null)).toBeUndefined();
  });

  it("priceNeedsRecreate flags amount/interval/currency divergence", () => {
    const live = {
      unit_amount: 999,
      currency: "usd",
      recurring: { interval: "month" },
      active: true,
    } as Parameters<typeof priceNeedsRecreate>[0];
    expect(priceNeedsRecreate(live, basePlan)).toBe(false);
    expect(priceNeedsRecreate({ ...live, unit_amount: 1299 }, basePlan)).toBe(
      true,
    );
    expect(priceNeedsRecreate({ ...live, active: false }, basePlan)).toBe(true);
    expect(
      priceNeedsRecreate(
        { ...live, recurring: { interval: "year" } } as typeof live,
        basePlan,
      ),
    ).toBe(true);
  });
});

/** Minimal Stripe mock recording calls and returning predictable ids. */
function mockStripe() {
  return {
    products: {
      create: vi.fn(() => Promise.resolve({ id: "prod_new" })),
      update: vi.fn(() => Promise.resolve({})),
    },
    prices: {
      create: vi.fn(() => Promise.resolve({ id: "price_new" })),
      retrieve: vi.fn(),
      update: vi.fn(() => Promise.resolve({})),
    },
    coupons: {
      create: vi.fn(() => Promise.resolve({ id: "coupon_new" })),
      retrieve: vi.fn(),
      update: vi.fn(() => Promise.resolve({})),
      del: vi.fn(() => Promise.resolve({})),
    },
    promotionCodes: {
      create: vi.fn(() => Promise.resolve({ id: "promo_new" })),
    },
  };
}

describe("syncPlanToStripe", () => {
  it("creates product + price when unsynced", async () => {
    const stripe = mockStripe();
    const res = await syncPlanToStripe(stripe as never, basePlan);
    expect(stripe.products.create).toHaveBeenCalledOnce();
    expect(stripe.prices.create).toHaveBeenCalledOnce();
    expect(res).toEqual({
      stripeProductId: "prod_new",
      stripePriceId: "price_new",
      stripeIntroCouponId: null,
    });
  });

  it("updates product but keeps price when amount is unchanged", async () => {
    const stripe = mockStripe();
    stripe.prices.retrieve.mockResolvedValue({
      unit_amount: 999,
      currency: "usd",
      recurring: { interval: "month" },
      active: true,
    });
    const res = await syncPlanToStripe(stripe as never, {
      ...basePlan,
      stripeProductId: "prod_1",
      stripePriceId: "price_1",
    });
    expect(stripe.products.update).toHaveBeenCalled();
    expect(stripe.prices.create).not.toHaveBeenCalled();
    expect(res.stripePriceId).toBe("price_1");
  });

  it("creates a new price and archives the old when amount changes", async () => {
    const stripe = mockStripe();
    stripe.prices.retrieve.mockResolvedValue({
      unit_amount: 999,
      currency: "usd",
      recurring: { interval: "month" },
      active: true,
    });
    const res = await syncPlanToStripe(stripe as never, {
      ...basePlan,
      unitAmount: 1299,
      stripeProductId: "prod_1",
      stripePriceId: "price_old",
    });
    expect(stripe.prices.create).toHaveBeenCalledOnce();
    expect(stripe.prices.update).toHaveBeenCalledWith("price_old", {
      active: false,
    });
    expect(res.stripePriceId).toBe("price_new");
  });

  it("creates a duration:once intro coupon", async () => {
    const stripe = mockStripe();
    await syncPlanToStripe(stripe as never, {
      ...basePlan,
      introOffer: { enabled: true, introAmount: 199 },
    });
    expect(stripe.coupons.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount_off: 800,
        duration: "once",
        currency: "usd",
      }),
    );
  });
});

describe("syncCouponToStripe", () => {
  it("creates coupon + promotion code with months-converted duration", async () => {
    const stripe = mockStripe();
    const input: CouponSyncInput = {
      id: 5,
      name: "Launch",
      discountType: "amount_off",
      value: 1000,
      currency: "usd",
      duration: "repeating",
      durationCount: 2,
      durationUnit: "year",
      code: "LAUNCH",
      maxRedemptions: 100,
    };
    const res = await syncCouponToStripe(stripe as never, input);
    expect(stripe.coupons.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount_off: 1000, duration_in_months: 24 }),
    );
    expect(stripe.promotionCodes.create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "LAUNCH",
        promotion: { type: "coupon", coupon: "coupon_new" },
      }),
    );
    expect(res.stripePromotionCodeId).toBe("promo_new");
  });
});
