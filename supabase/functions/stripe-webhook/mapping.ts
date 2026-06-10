// Pure mapping helpers for the Stripe webhook — Stripe event objects → the rows
// we upsert into Postgres. Deliberately free of any Deno/`npm:`/`jsr:` imports
// and of the `Deno` global, so the SAME source is imported by the edge function
// (`./mapping.ts`) AND unit-tested under vitest (Node) in `tooling/edge-tests`.
//
// Inputs are *structural subsets* of the Stripe SDK objects — only the fields
// the handlers actually read — so Stripe.Product/Price/Subscription/Session
// satisfy them without a hard dependency on the SDK's types.

export interface ProductInput {
  id: string;
  active: boolean;
  name: string;
  description?: string | null;
  images?: string[] | null;
  metadata: Record<string, string>;
}

export interface ProductRow {
  id: string;
  active: boolean;
  name: string;
  description: string | null;
  image: string | null;
  metadata: Record<string, string>;
}

export interface PriceInput {
  id: string;
  product: string | { id: string };
  active: boolean;
  unit_amount: number | null;
  currency: string;
  type: string;
  recurring?: { interval?: string; interval_count?: number } | null;
  metadata: Record<string, string>;
}

export interface PriceRow {
  id: string;
  product_id: string;
  active: boolean;
  unit_amount: number | null;
  currency: string;
  type: string;
  interval: string | null;
  interval_count: number | null;
  metadata: Record<string, string>;
}

export interface CheckoutSessionInput {
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
  customer?: string | { id: string } | null;
}

export interface SubscriptionItemInput {
  price: { id: string };
  quantity?: number | null;
  current_period_end?: number;
}

export interface SubscriptionInput {
  id: string;
  customer: string | { id: string };
  status: string;
  cancel_at_period_end: boolean;
  metadata?: Record<string, string> | null;
  items: { data: SubscriptionItemInput[] };
  current_period_end?: number;
}

export interface SubscriptionRow {
  id: string;
  user_id: string;
  price_id: string | null;
  status: string;
  quantity: number | null;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
}

/** Stripe sends Unix seconds; the DB wants ISO timestamps (or null). */
export function isoOrNull(seconds: number | null | undefined): string | null {
  return typeof seconds === "number"
    ? new Date(seconds * 1000).toISOString()
    : null;
}

/** A `customer`/`product` field may be an id string or an expanded object. */
function idOf(ref: string | { id: string }): string {
  return typeof ref === "string" ? ref : ref.id;
}

export function mapProduct(p: ProductInput): ProductRow {
  return {
    id: p.id,
    active: p.active,
    name: p.name,
    description: p.description ?? null,
    image: p.images?.[0] ?? null,
    metadata: p.metadata,
  };
}

export function mapPrice(pr: PriceInput): PriceRow {
  return {
    id: pr.id,
    product_id: idOf(pr.product),
    active: pr.active,
    unit_amount: pr.unit_amount,
    currency: pr.currency,
    type: pr.type,
    interval: pr.recurring?.interval ?? null,
    interval_count: pr.recurring?.interval_count ?? null,
    metadata: pr.metadata,
  };
}

/** Resolve the (user, customer) pair a completed Checkout session maps to. */
export function resolveCheckoutCustomer(s: CheckoutSessionInput): {
  userId: string | null;
  customerId: string | null;
} {
  return {
    userId: s.client_reference_id ?? s.metadata?.supabase_user_id ?? null,
    customerId: s.customer == null ? null : idOf(s.customer),
  };
}

/** The Stripe customer id a subscription belongs to. */
export function subscriptionCustomerId(sub: SubscriptionInput): string {
  return idOf(sub.customer);
}

/** A subscription's user id from its metadata, if Stripe carried it through. */
export function subscriptionUserIdFromMetadata(
  sub: SubscriptionInput,
): string | null {
  return sub.metadata?.supabase_user_id ?? null;
}

export function mapSubscription(
  sub: SubscriptionInput,
  userId: string,
): SubscriptionRow {
  const item = sub.items.data[0];
  return {
    id: sub.id,
    user_id: userId,
    price_id: item?.price.id ?? null,
    status: sub.status,
    quantity: item?.quantity ?? null,
    cancel_at_period_end: sub.cancel_at_period_end,
    // current_period_end moved onto the subscription item in recent API
    // versions; fall back to the subscription-level field for older payloads.
    current_period_end:
      isoOrNull(item?.current_period_end) ?? isoOrNull(sub.current_period_end),
  };
}
