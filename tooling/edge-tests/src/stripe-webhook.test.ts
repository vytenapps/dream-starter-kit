/**
 * Unit tests for the Stripe-webhook mapping helpers. These pure functions turn
 * Stripe event objects into the rows the edge function upserts; the edge
 * function (`supabase/functions/stripe-webhook/index.ts`) imports the same
 * module, so this is real coverage of the sync logic without a live Stripe.
 *
 * The edge function itself is Deno (npm:/jsr: imports + signature verification +
 * service-role writes) and is not unit-tested here — only the portable mapping.
 */
import { describe, expect, it } from "vitest";

import {
  isoOrNull,
  mapPrice,
  mapProduct,
  mapSubscription,
  resolveCheckoutCustomer,
  subscriptionCustomerId,
  subscriptionUserIdFromMetadata,
} from "../../../supabase/functions/stripe-webhook/mapping";

describe("isoOrNull", () => {
  it("converts Unix seconds to an ISO timestamp", () => {
    expect(isoOrNull(0)).toBe("1970-01-01T00:00:00.000Z");
    expect(isoOrNull(1_700_000_000)).toBe("2023-11-14T22:13:20.000Z");
  });

  it("returns null for null/undefined", () => {
    expect(isoOrNull(null)).toBeNull();
    expect(isoOrNull(undefined)).toBeNull();
  });
});

describe("mapProduct", () => {
  it("maps fields and picks the first image", () => {
    expect(
      mapProduct({
        id: "prod_1",
        active: true,
        name: "Pro",
        description: "desc",
        images: ["a.png", "b.png"],
        metadata: { k: "v" },
      }),
    ).toEqual({
      id: "prod_1",
      active: true,
      name: "Pro",
      description: "desc",
      image: "a.png",
      metadata: { k: "v" },
    });
  });

  it("nulls a missing description and image", () => {
    const row = mapProduct({
      id: "prod_2",
      active: false,
      name: "Basic",
      metadata: {},
    });
    expect(row.description).toBeNull();
    expect(row.image).toBeNull();
  });
});

describe("mapPrice", () => {
  it("resolves an expanded product object to its id and reads recurring", () => {
    expect(
      mapPrice({
        id: "price_1",
        product: { id: "prod_1" },
        active: true,
        unit_amount: 999,
        currency: "usd",
        type: "recurring",
        recurring: { interval: "month", interval_count: 1 },
        metadata: {},
      }),
    ).toEqual({
      id: "price_1",
      product_id: "prod_1",
      active: true,
      unit_amount: 999,
      currency: "usd",
      type: "recurring",
      interval: "month",
      interval_count: 1,
      metadata: {},
    });
  });

  it("accepts a product id string and nulls recurring fields for one-time prices", () => {
    const row = mapPrice({
      id: "price_2",
      product: "prod_2",
      active: true,
      unit_amount: null,
      currency: "eur",
      type: "one_time",
      metadata: {},
    });
    expect(row.product_id).toBe("prod_2");
    expect(row.interval).toBeNull();
    expect(row.interval_count).toBeNull();
  });
});

describe("resolveCheckoutCustomer", () => {
  it("prefers client_reference_id, falls back to metadata", () => {
    expect(
      resolveCheckoutCustomer({
        client_reference_id: "user_a",
        metadata: { supabase_user_id: "user_b" },
        customer: "cus_1",
      }),
    ).toEqual({ userId: "user_a", customerId: "cus_1" });

    expect(
      resolveCheckoutCustomer({
        metadata: { supabase_user_id: "user_b" },
        customer: { id: "cus_2" },
      }),
    ).toEqual({ userId: "user_b", customerId: "cus_2" });
  });

  it("returns nulls when neither user nor customer is present", () => {
    expect(resolveCheckoutCustomer({})).toEqual({
      userId: null,
      customerId: null,
    });
  });
});

describe("subscription helpers", () => {
  const baseSub = {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    cancel_at_period_end: false,
    items: { data: [{ price: { id: "price_1" }, quantity: 2 }] },
  };

  it("reads the customer id (string or expanded)", () => {
    expect(subscriptionCustomerId(baseSub)).toBe("cus_1");
    expect(
      subscriptionCustomerId({ ...baseSub, customer: { id: "cus_x" } }),
    ).toBe("cus_x");
  });

  it("reads the user id from metadata when present", () => {
    expect(subscriptionUserIdFromMetadata(baseSub)).toBeNull();
    expect(
      subscriptionUserIdFromMetadata({
        ...baseSub,
        metadata: { supabase_user_id: "user_a" },
      }),
    ).toBe("user_a");
  });

  it("maps the first item's price/quantity and the item-level period end", () => {
    expect(
      mapSubscription(
        {
          ...baseSub,
          items: {
            data: [
              {
                price: { id: "price_1" },
                quantity: 2,
                current_period_end: 1_700_000_000,
              },
            ],
          },
        },
        "user_a",
      ),
    ).toEqual({
      id: "sub_1",
      user_id: "user_a",
      price_id: "price_1",
      status: "active",
      quantity: 2,
      cancel_at_period_end: false,
      current_period_end: "2023-11-14T22:13:20.000Z",
    });
  });

  it("falls back to the subscription-level period end for older payloads", () => {
    const row = mapSubscription(
      { ...baseSub, current_period_end: 1_700_000_000 },
      "user_a",
    );
    expect(row.current_period_end).toBe("2023-11-14T22:13:20.000Z");
  });

  it("tolerates an empty items list", () => {
    const row = mapSubscription({ ...baseSub, items: { data: [] } }, "user_a");
    expect(row.price_id).toBeNull();
    expect(row.quantity).toBeNull();
    expect(row.current_period_end).toBeNull();
  });
});
