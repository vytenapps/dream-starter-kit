import type { ExtSeedStep } from "@acme/ext-kit/payload";

/**
 * Demo billing catalog — runs through the host's idempotent CMS seed flow
 * (the whole seed bails if content exists, so steps don't re-check).
 *
 * Plans/coupons sync to Stripe at seed time **only when `STRIPE_SECRET_KEY` is
 * set** — so a configured deploy gets immediately-purchasable seeded plans
 * (the `/pricing` checkout needs a `stripePriceId`). Without a key (local dev,
 * CI, cloud sessions) the sync hook is skipped, so the seed stays offline-safe
 * and scalar-only; those plans show as `unsynced` and become purchasable the
 * first time an admin saves them in `/admin`. The hook already fails soft
 * (records `syncError`, never blocks the save), so enabling it here is safe.
 */
const skipStripeSync = !process.env.STRIPE_SECRET_KEY;

export const seed: ExtSeedStep[] = [
  {
    label: "Plans & pricing",
    run: async (payload) => {
      const monthly = await payload.create({
        collection: "ext-billing-plans",
        context: { skipStripeSync },
        data: {
          name: "Dream Monthly Plan",
          slug: "dream-monthly",
          description: "Full access, billed monthly.",
          pricingType: "recurring",
          interval: "month",
          unitAmount: 999,
          currency: "usd",
          displayOrder: 1,
          features: [
            { text: "Everything in Free" },
            { text: "Unlimited AI chat" },
            { text: "Priority support" },
          ],
        },
      });
      const annual = await payload.create({
        collection: "ext-billing-plans",
        context: { skipStripeSync },
        data: {
          name: "Dream Annual Plan",
          slug: "dream-annual",
          description:
            "Full access, billed yearly. Includes a 7-day free trial.",
          pricingType: "recurring",
          interval: "year",
          unitAmount: 9999,
          currency: "usd",
          trialDays: 7,
          badge: "Best value",
          highlighted: true,
          displayOrder: 2,
          features: [
            { text: "Everything in Monthly" },
            { text: "7-day free trial" },
            { text: "2 months free vs monthly" },
          ],
        },
      });
      const lifetime = await payload.create({
        collection: "ext-billing-plans",
        context: { skipStripeSync },
        data: {
          name: "Dream Lifetime Plan",
          slug: "dream-lifetime",
          description: "One payment, lifetime access.",
          pricingType: "one_time",
          unitAmount: 39900,
          currency: "usd",
          displayOrder: 3,
          features: [
            { text: "Everything in Annual" },
            { text: "Pay once, own forever" },
            { text: "All future updates" },
          ],
        },
      });
      // Inactive demo of an introductory offer ($1.99 first month → $39.99/mo)
      // so the capability is visible out of the box without affecting pricing.
      await payload.create({
        collection: "ext-billing-plans",
        context: { skipStripeSync },
        data: {
          name: "Dream Pro (intro demo)",
          slug: "dream-pro-intro-demo",
          description: "$1.99 for the first month, then $39.99/month.",
          pricingType: "recurring",
          interval: "month",
          unitAmount: 3999,
          currency: "usd",
          active: false,
          displayOrder: 99,
          introOffer: { enabled: true, introAmount: 199 },
          features: [{ text: "Example intro pricing" }],
        },
      });

      // Welcome coupon — the signup flow mints a unique, expiring promotion
      // code for this coupon per new free account.
      await payload.create({
        collection: "ext-billing-coupons",
        context: { skipStripeSync },
        data: {
          name: "Welcome offer",
          discountType: "percent_off",
          value: 20,
          duration: "once",
          isWelcomeOffer: true,
        },
      });

      await payload.updateGlobal({
        slug: "ext-billing-settings",
        data: {
          heading: "Pricing",
          subheading: "Start free. Upgrade when you're ready.",
          billingToggleDefault: "monthly",
          showFreeTier: true,
          featuredPlans: [monthly.id, annual.id, lifetime.id],
          freeTier: {
            name: "Free",
            description: "Everything you need to get started.",
            ctaLabel: "Get started",
            features: [
              { text: "Core features" },
              { text: "Community support" },
            ],
          },
        },
      });
    },
  },
];
